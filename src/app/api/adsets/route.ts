import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { withCacheSWR, generateCacheKey, CacheTTL, deleteCache } from '@/lib/cache/redis';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { getApiAccountCap, getDynamicChunkSize, getDynamicChunkDelayMs } from '@/lib/plan-limits';
import { MAX_ACCOUNTS_PER_REQUEST } from '@/lib/meta-quota-config';

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

    // Split comma-separated IDs and normalize to Meta format (act_xxx)
    let adAccountIds = adAccountId
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => (id.startsWith('act_') ? id : `act_${id}`));

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

    // Meta Account Integrity Compliance: Use ONLY user's own tokens
    const { getUserTokensOnly } = await import('@/lib/facebook/user-tokens-only');
    const tokens = await getUserTokensOnly(session);

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected', adSets: [] },
        { status: 400 }
      );
    }

    const plan = (user as any)?.plan || 'FREE';
    const planCap = getApiAccountCap(plan);
    const requestCap = Math.min(planCap, MAX_ACCOUNTS_PER_REQUEST);
    const requestedAccountCount = adAccountIds.length;
    if (adAccountIds.length > requestCap) {
      adAccountIds = adAccountIds.slice(0, requestCap);
    }

    const forceRefresh = searchParams.get('refresh') === 'true';
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    // const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || 50)) : 50;
    // const offsetParam = searchParams.get('offset');
    // const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
    const usePaginated = false; // typeof limit === 'number' && limit <= 500;

    const CACHE_VERSION = 'v2'; // v2: paginated first-page
    const dateRangeKey = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : 'all';
    const cacheKey = generateCacheKey(
      `meta:adsets:${CACHE_VERSION}`,
      session.user.id!,
      `${adAccountIds.sort().join(',')}:${dateRangeKey}:${usePaginated ? 'fp' : 'all'}:${statusParam || 'all'}`
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
        const chunkSize = getDynamicChunkSize(adAccountIds.length);
        const chunkDelayMs = getDynamicChunkDelayMs(adAccountIds.length);
        return await fetchAdSetsFromMeta(adAccountIds, tokens, dateFrom, dateTo, statusParam, usePaginated, chunkSize, chunkDelayMs);
      }
    );

    // withCacheSWR returns { data, isStale, revalidating } – use result.data
    const data = result?.data ?? { adsets: [], errors: [] };
    const adsets = data.adsets ?? [];
    return NextResponse.json({
      adsets,
      total: adsets.length,
      errors: data.errors ?? [],
      accountsIncluded: adAccountIds.length,
      ...(requestedAccountCount > adAccountIds.length && { accountsTruncated: requestedAccountCount }),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function defined OUTSIDE to avoid clutter and scope issues
async function fetchAdSetsFromMeta(
  adAccountIds: string[],
  tokens: TokenInfo[],
  dateFrom?: string | null,
  dateTo?: string | null,
  statusParam?: string | null,
  firstPageOnly = false,
  chunkSize = 10,
  chunkDelayMs = 100
) {
  const allAdSets: any[] = [];
  const errors: string[] = [];

  // Build insights time range parameter
  let insightsTimeRange = 'date_preset(last_30d)';
  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (toDate.getTime() <= today.getTime() && fromDate.getTime() <= toDate.getTime()) {
      const since = fromDate.toISOString().split('T')[0];
      const until = toDate.toISOString().split('T')[0];
      insightsTimeRange = `time_range({'since':'${since}','until':'${until}'})`;
    }
  }

  for (let i = 0; i < adAccountIds.length; i += chunkSize) {
    const chunk = adAccountIds.slice(i, i + chunkSize);

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

        if (!accountResponse.ok) {
          // optional handling
        }

        const accountData = await accountResponse.json();
        const accountCurrency = accountData.currency || 'USD';

        // Explicitly request ALL statuses to avoid default filtering (Active-only)
        // Default: Fetch all ALIVE statuses (Active, Paused, etc.) but EXCLUDE Deleted/Archived to prevent timeouts
        let statuses = ["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "DISABLED"];

        if (statusParam === 'deleted') {
          statuses = ["DELETED"];
        } else if (['archived', 'completed'].includes(statusParam || '')) {
          statuses = ["ARCHIVED"];
        }

        const filtering = encodeURIComponent(JSON.stringify([{ field: "effective_status", operator: "IN", value: statuses }]));

        const initialUrl = `https://graph.facebook.com/v22.0/${accountId}/adsets?fields=id,name,status,effective_status,configured_status,issues_info,ads{effective_status},campaign_id,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,targeting,created_time,insights.${insightsTimeRange}{spend,actions,reach,impressions,clicks}&limit=200&filtering=${filtering}&access_token=${token}`;

        // Simplified generic fetch since I can't confirm import existence of fetchFirstPage/fetchAllPages
        const fetchAllPages = async (url: string, token: string) => {
          let data: any[] = [];
          let nextUrl = url;
          while (nextUrl) {
            const res = await fetch(nextUrl);
            const json = await res.json();
            if (json.data) data.push(...json.data);
            nextUrl = json.paging?.next;
          }
          return data;
        };

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

    if (i + chunkSize < adAccountIds.length) {
      await new Promise(resolve => setTimeout(resolve, chunkDelayMs));
    }
  }

  return { adsets: allAdSets, errors };
}
