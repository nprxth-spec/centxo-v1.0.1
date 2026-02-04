import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { withCacheSWR, generateCacheKey, CacheTTL, deleteCache } from '@/lib/cache/redis';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimit(request, RateLimitPresets.standard);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const adAccountId = searchParams.get('adAccountId');

    if (!adAccountId) {
      return NextResponse.json({ error: 'adAccountId is required' }, { status: 400 });
    }

    // Split comma-separated IDs
    const adAccountIds = adAccountId.split(',').filter(Boolean);

    // Get date range parameters
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Fetch user with team members and MetaAccount to get all tokens
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        teamMembers: true,
        metaAccount: {
          select: { accessToken: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Collect all tokens
    const tokens: TokenInfo[] = [];

    // 1. Try MetaAccount first (most reliable)
    if ((user as any).metaAccount?.accessToken) {
      tokens.push({ token: (user as any).metaAccount.accessToken, name: 'Main' });
    }

    // 2. Fallback to session token
    const mainAccessToken = (session as any).accessToken;
    if (mainAccessToken && !tokens.some(t => t.token === mainAccessToken)) {
      tokens.push({ token: mainAccessToken, name: 'Session' });
    }

    // 3. Query team members and team owner tokens
    // Check if current user is a team member first
    const memberRecord = await prisma.teamMember.findFirst({
      where: { memberEmail: session.user.email },
    });

    let teamOwnerId = user.id; // Default to current user

    if (memberRecord?.userId) {
      // Current user is a team member, use team owner's ID
      teamOwnerId = memberRecord.userId;
      console.log('[adsets] User is team member, fetching owner tokens from:', teamOwnerId);
    }

    // Fetch team owner's data (MetaAccount + accounts)
    const teamOwner = await prisma.user.findUnique({
      where: { id: teamOwnerId },
      include: {
        metaAccount: {
          select: { accessToken: true },
        },
      },
    });

    // Add team owner's MetaAccount token (if user is a team member)
    if (teamOwner?.metaAccount?.accessToken && teamOwnerId !== user.id) {
      tokens.push({ token: teamOwner.metaAccount.accessToken, name: teamOwner.name || 'Team Owner' });
    }

    // Fetch all team members under the team owner
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        userId: teamOwnerId,
        memberType: 'facebook',
        facebookUserId: { not: null },
        accessToken: { not: null },
      },
    });

    // Add team member tokens
    if (teamMembers) {
      teamMembers.forEach((m: any) => {
        if (m.accessToken && !tokens.some(t => t.token === m.accessToken)) {
          tokens.push({ token: m.accessToken, name: m.facebookName || 'Member' });
        }
      });
    }

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected', adSets: [] },
        { status: 400 }
      );
    }

    const forceRefresh = searchParams.get('refresh') === 'true';
    const CACHE_VERSION = 'v1';
    const dateRangeKey = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : 'all';
    const cacheKey = generateCacheKey(
      `meta:adsets:${CACHE_VERSION}`,
      session.user.id!,
      `${adAccountIds.sort().join(',')}:${dateRangeKey}`
    );

    if (forceRefresh) {
      await deleteCache(cacheKey);
      await deleteCache(`${cacheKey}:meta`);
    }

    const STALE_TTL = 3600;
    const result = await withCacheSWR(
      cacheKey,
      CacheTTL.ADSETS_LIST,
      STALE_TTL,
      async () => {
        return await fetchAdSetsFromMeta(adAccountIds, tokens, dateFrom, dateTo);
      }
    );

    // Ensure we have valid data
    const adsets = result.data?.adsets || [];
    const errors = result.data?.errors || [];

    return NextResponse.json({
      adsets: adsets,
      count: adsets.length,
      errors: errors,
      isStale: result.isStale,
    });
  } catch (error) {
    console.error('Error in GET /api/adsets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad sets', details: error instanceof Error ? error.message : 'Unknown error', adsets: [], errors: [] },
      { status: 500 }
    );
  }
}

// Helper to fetch all pages of data from Facebook API
async function fetchAllPages(initialUrl: string, token: string): Promise<any[]> {
  let allData: any[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    try {
      const res: Response = await fetch(nextUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch page: ${res.statusText}`);
      }

      const data: any = await res.json();
      if (data.data && Array.isArray(data.data)) {
        allData = allData.concat(data.data);
      }

      // Update nextUrl for next page
      nextUrl = data.paging?.next || null;

    } catch (error) {
      console.error('Error fetching page:', error);
      nextUrl = null; // Stop pagination on error
    }
  }

  return allData;
}

async function fetchAdSetsFromMeta(adAccountIds: string[], tokens: TokenInfo[], dateFrom?: string | null, dateTo?: string | null) {
  const allAdSets: any[] = [];
  const errors: string[] = [];

  // Build insights time range parameter
  let insightsTimeRange = 'date_preset(last_30d)';
  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const since = fromDate.toISOString().split('T')[0];
    const until = toDate.toISOString().split('T')[0];
    insightsTimeRange = `time_range({'since':'${since}','until':'${until}'})`;
  }

  // Chunk requests to avoid rate limiting
  const CHUNK_SIZE = 5; // Reduced chunk size for pagination safety

  for (let i = 0; i < adAccountIds.length; i += CHUNK_SIZE) {
    const chunk = adAccountIds.slice(i, i + CHUNK_SIZE);

    await Promise.all(chunk.map(async (accountId) => {
      // Use helper to find correct token (uses Redis cache)
      const token = await getValidTokenForAdAccount(accountId, tokens);

      if (!token) {
        errors.push(`No valid access token found for account ${accountId}`);
        return;
      }

      try {
        const accountResponse = await fetch(
          `https://graph.facebook.com/v22.0/${accountId}?fields=currency&access_token=${token}`
        );

        // accountResponse check omitted as token helper confirms access, but we need fields
        if (!accountResponse.ok) {
          // Should potentially retry token here? Helper should have returned a valid one.
        }

        const accountData = await accountResponse.json();
        const accountCurrency = accountData.currency || 'USD';

        const initialUrl = `https://graph.facebook.com/v22.0/${accountId}/adsets?fields=id,name,status,effective_status,configured_status,issues_info,ads{effective_status},campaign_id,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,targeting,created_time,insights.${insightsTimeRange}{spend,actions,reach,impressions,clicks}&limit=200&access_token=${token}`;

        // Use pagination helper
        const adSets = await fetchAllPages(initialUrl, token);

        if (adSets.length > 0) {

          // Add account ID and currency to each ad set
          const adSetsWithAccount = adSets.map((adSet: any) => {
            const insights = adSet.insights?.data?.[0];
            const spend = parseFloat(insights?.spend || '0');

            // Extract messaging contacts from actions
            const actions = insights?.actions || [];
            const messagingContactsAction = actions.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
            const messagingContacts = parseInt(messagingContactsAction?.value || '0');

            return {
              id: adSet.id,
              name: adSet.name,
              status: adSet.status,
              ads: adSet.ads?.data?.map((a: any) => ({ effectiveStatus: a.effective_status })) || [],
              effectiveStatus: adSet.effective_status,
              configuredStatus: adSet.configured_status,
              issuesInfo: adSet.issues_info || [],
              campaignId: adSet.campaign_id,
              dailyBudget: adSet.daily_budget ? parseFloat(adSet.daily_budget) / 100 : 0,
              lifetimeBudget: adSet.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : 0,
              optimizationGoal: adSet.optimization_goal || '-',
              billingEvent: adSet.billing_event || '-',
              bidAmount: adSet.bid_amount ? parseFloat(adSet.bid_amount) / 100 : 0,
              targeting: adSet.targeting || null,
              createdAt: adSet.created_time,
              adAccountId: accountId,
              currency: accountCurrency,
              metrics: {
                spend: spend,
                reach: parseInt(insights?.reach || '0'),
                impressions: parseInt(insights?.impressions || '0'),
                clicks: parseInt(insights?.clicks || '0'),
                messagingContacts: messagingContacts,
                results: messagingContacts,
                costPerResult: messagingContacts > 0 ? spend / messagingContacts : 0,
              },
            };
          });

          allAdSets.push(...adSetsWithAccount);
        }

      } catch (err: any) {
        errors.push(`Error for account ${accountId}: ${err.message}`);
      }
    }));

    if (i + CHUNK_SIZE < adAccountIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return { adsets: allAdSets, errors };
}
