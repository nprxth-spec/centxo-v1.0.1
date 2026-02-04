import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { campaignsQuerySchema, validateQueryParams } from '@/lib/validation';
import { withCache, withCacheSWR, generateCacheKey, CacheTTL, deleteCache } from '@/lib/cache/redis';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { decryptToken } from '@/lib/services/metaClient';

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions);

    // Rate limiting (User ID priority)
    const rateLimitResponse = await rateLimit(request, RateLimitPresets.standard, session?.user?.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const adAccountIdsParam = searchParams.get('adAccountId');

    if (!adAccountIdsParam) {
      return NextResponse.json({ error: 'Ad account ID required' }, { status: 400 });
    }

    const adAccountIds = adAccountIdsParam.split(',').filter(Boolean);

    // Get date range parameters
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Fetch user with team members and MetaAccount to get all tokens
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        metaAccount: {
          select: { accessToken: true },
        },
        accounts: {
          where: { provider: 'facebook' },
          select: { access_token: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Collect all tokens
    const tokens: TokenInfo[] = [];

    // 1. MetaAccount token (encrypted, needs decryption)
    if ((user as any).metaAccount?.accessToken) {
      try {
        const decrypted = decryptToken((user as any).metaAccount.accessToken);
        tokens.push({ token: decrypted, name: user.name || 'Main Account' });
      } catch (e) {
        console.error('[campaigns] Failed to decrypt MetaAccount token:', e);
      }
    }

    // 2. NextAuth Facebook account tokens
    if ((user as any).accounts) {
      (user as any).accounts.forEach((acc: any) => {
        if (acc.access_token && !tokens.some(t => t.token === acc.access_token)) {
          tokens.push({ token: acc.access_token, name: user.name || 'Account' });
        }
      });
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
      console.log('[campaigns] User is team member, fetching owner tokens from:', teamOwnerId);
    }

    // Fetch team owner's data (MetaAccount + Facebook accounts)
    const teamOwner = await prisma.user.findUnique({
      where: { id: teamOwnerId },
      include: {
        metaAccount: {
          select: { accessToken: true },
        },
        accounts: {
          where: { provider: 'facebook' },
          select: { access_token: true },
        },
      },
    });

    // Add team owner's MetaAccount token
    if (teamOwner?.metaAccount?.accessToken && teamOwnerId !== user.id) {
      try {
        const decrypted = decryptToken(teamOwner.metaAccount.accessToken);
        if (!tokens.some(t => t.token === decrypted)) {
          tokens.push({ token: decrypted, name: teamOwner.name || 'Team Owner' });
        }
      } catch (e) {
        console.error('[campaigns] Failed to decrypt team owner MetaAccount token:', e);
      }
    }

    // Add team owner's Facebook account tokens
    if (teamOwner?.accounts) {
      teamOwner.accounts.forEach((acc: any) => {
        if (acc.access_token && !tokens.some(t => t.token === acc.access_token)) {
          tokens.push({ token: acc.access_token, name: teamOwner.name || 'Team Owner Account' });
        }
      });
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
    teamMembers.forEach((member: any) => {
      if (member.accessToken && !tokens.some(t => t.token === member.accessToken)) {
        tokens.push({ token: member.accessToken, name: member.facebookName || 'Team Member' });
      }
    });

    console.log('[campaigns] Found tokens:', tokens.length);

    // 4. Fallback to session token
    const sessionToken = (session as any).accessToken;
    if (sessionToken && !tokens.some(t => t.token === sessionToken)) {
      tokens.push({ token: sessionToken, name: 'Session' });
    }

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected', campaigns: [] },
        { status: 400 }
      );
    }

    // Check for force refresh
    const forceRefresh = searchParams.get('refresh') === 'true';
    const mode = searchParams.get('mode'); // 'lite' or undefined (full)
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || 10)) : undefined;

    // Create cache key
    const CACHE_VERSION = 'v2';
    const dateRangeKey = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : 'all';
    const cacheKey = generateCacheKey(
      `meta:campaigns:${CACHE_VERSION}`,
      session.user.id!,
      `${adAccountIds.sort().join(',')}:${dateRangeKey}:${mode || 'full'}:${limit ?? 'all'}`
    );

    // Delete cache if force refresh
    if (forceRefresh) {
      await deleteCache(cacheKey);
      await deleteCache(`${cacheKey}:meta`);
    }

    // Fetch campaigns with SWR
    const STALE_TTL = 3600;
    const result = await withCacheSWR(
      cacheKey,
      CacheTTL.CAMPAIGNS_LIST,
      STALE_TTL,
      async () => {
        return await fetchCampaignsFromMeta(adAccountIds, tokens, dateFrom, dateTo, mode);
      }
    );

    let campaigns = result.data.campaigns;
    if (typeof limit === 'number' && limit > 0 && campaigns.length > limit) {
      campaigns = campaigns.slice(0, limit);
    }

    return NextResponse.json({
      campaigns,
      total: result.data.campaigns.length,
      returned: campaigns.length,
      errors: result.data.errors,
      isStale: result.isStale,
      revalidating: result.revalidating,
    });
  } catch (error) {
    console.error('Error in GET /api/campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error instanceof Error ? error.message : 'Unknown error' },
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

async function fetchCampaignsFromMeta(adAccountIds: string[], tokens: TokenInfo[], dateFrom?: string | null, dateTo?: string | null, mode?: string | null) {
  const allCampaigns: any[] = [];
  const errors: string[] = [];

  // Build insights time range parameter
  let insightsTimeRange = 'date_preset(last_30d)';
  if (dateFrom && dateTo && mode !== 'lite') {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const since = fromDate.toISOString().split('T')[0];
    const until = toDate.toISOString().split('T')[0];
    insightsTimeRange = `time_range({'since':'${since}','until':'${until}'})`;
  }

  // Chunk requests to avoid rate limiting
  const CHUNK_SIZE = 5; // Reduced for safety

  for (let i = 0; i < adAccountIds.length; i += CHUNK_SIZE) {
    const chunk = adAccountIds.slice(i, i + CHUNK_SIZE);

    await Promise.all(chunk.map(async (adAccountId) => {
      try {
        // Use helper to find correct token (uses Redis cache)
        const token = await getValidTokenForAdAccount(adAccountId, tokens);

        if (!token) {
          errors.push(`No valid access token found for account ${adAccountId}`);
          return;
        }

        // Fetch Data using the found token
        // Lite Mode: Skip Insights, Skip AdSets, Minimal Fields
        if (mode === 'lite') {
          // Pagination for Lite Mode
          const initialUrl = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=id,name,status,effective_status,configured_status,created_time&limit=200&access_token=${token}`;
          const campaigns = await fetchAllPages(initialUrl, token);

          const formatted = campaigns.map((campaign: any) => ({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            effectiveStatus: campaign.effective_status,
            createdAt: new Date(campaign.created_time),
            // Minimal stats (placeholders)
            metrics: { spend: 0, messages: 0, results: 0, costPerResult: 0 },
            adAccountId: adAccountId,
            currency: 'USD'
          }));
          allCampaigns.push(...formatted);
          return; // Done for this account in lite mode
        }

        // Standard Mode (Full)
        // Run requests in parallel
        const [accountResponse] = await Promise.all([
          fetch(
            `https://graph.facebook.com/v22.0/${adAccountId}?fields=currency&access_token=${token}`
          )
        ]);

        // Campaigns fetch with pagination
        const initialUrl = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=id,name,status,effective_status,configured_status,objective,daily_budget,lifetime_budget,spend_cap,issues_info,adsets{effective_status,ads{effective_status}},created_time,insights.${insightsTimeRange}{spend,actions,cost_per_action_type,reach,impressions,clicks}&limit=200&access_token=${token}`;
        const campaigns = await fetchAllPages(initialUrl, token);

        let accountCurrency = 'USD';
        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          accountCurrency = accountData.currency || 'USD';
        }

        // Transform to our format
        const formatted = campaigns.map((campaign: any) => {
          const insights = campaign.insights?.data?.[0];
          const messageAction = insights?.actions?.find((a: any) =>
            a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
          );
          const messages = parseInt(messageAction?.value || '0');
          const spend = parseFloat(insights?.spend || '0');

          // Get post engagements
          const postEngagementAction = insights?.actions?.find((a: any) =>
            a.action_type === 'post_engagement'
          );
          const postEngagements = parseInt(postEngagementAction?.value || '0');

          // Get messaging contacts
          const messagingContactsAction = insights?.actions?.find((a: any) =>
            a.action_type === 'onsite_conversion.messaging_first_reply'
          );
          const messagingContacts = parseInt(messagingContactsAction?.value || '0');

          // Get cost per result
          const costPerResult = messages > 0 ? spend / messages : 0;
          const reach = parseInt(insights?.reach || '0');
          const impressions = parseInt(insights?.impressions || '0');
          const clicks = parseInt(insights?.clicks || '0');

          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            effectiveStatus: campaign.effective_status,
            configuredStatus: campaign.configured_status,
            objective: campaign.objective,
            adSets: campaign.adsets?.data?.map((a: any) => ({
              effectiveStatus: a.effective_status,
              ads: a.ads?.data?.map((ad: any) => ({ effectiveStatus: ad.effective_status })) || []
            })) || [],
            dailyBudget: parseFloat(campaign.daily_budget || '0') / 100,
            lifetimeBudget: parseFloat(campaign.lifetime_budget || '0') / 100,
            spendCap: parseFloat(campaign.spend_cap || '0') / 100,
            issuesInfo: campaign.issues_info || [],
            createdAt: new Date(campaign.created_time),
            metrics: {
              spend: spend,
              messages: messages,
              costPerMessage: messages > 0 ? spend / messages : 0,
              results: messages,
              costPerResult: costPerResult,
              budget: parseFloat(campaign.daily_budget || campaign.lifetime_budget || '0') / 100,
              reach: reach,
              impressions: impressions,
              postEngagements: postEngagements,
              clicks: clicks,
              messagingContacts: messagingContacts,
              amountSpent: spend,
            },
            adsCount: { total: 0, active: 0 },
            adAccountId: adAccountId,
            currency: accountCurrency
          };
        });

        allCampaigns.push(...formatted);

      } catch (err: any) {
        errors.push(`Error for account ${adAccountId}: ${err.message}`);
      }
    }));

    // Add small delay between chunks to respect rate limits
    if (i + CHUNK_SIZE < adAccountIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Sort by latest created
  allCampaigns.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { campaigns: allCampaigns, errors };
}
