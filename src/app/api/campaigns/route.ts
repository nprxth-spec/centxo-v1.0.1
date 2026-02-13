import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { withCacheSWR, generateCacheKey, CacheTTL, deleteCache } from '@/lib/cache/redis';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { getApiAccountCap, getLiteModeThreshold, getDynamicChunkSize, getDynamicChunkDelayMs } from '@/lib/plan-limits';
import { MAX_ACCOUNTS_PER_REQUEST } from '@/lib/meta-quota-config';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Rate limiting (User ID priority)
    const rateLimitResponse = await rateLimit(request, RateLimitPresets.standard, session?.user?.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

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

    // Fetch user for plan and subscription pool filtering
    const { prisma } = await import('@/lib/prisma');
    const { getSubscriptionPool } = await import('@/lib/subscription-filter');

    // Get user and subscription pool in parallel
    const [user, pool] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true }
      }),
      getSubscriptionPool(session.user.id, session.user.email || undefined)
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (pool.adAccountIds.length > 0) {
      const normalizedPool = pool.adAccountIds.map(id => id.startsWith('act_') ? id : `act_${id}`);
      adAccountIds = adAccountIds.filter(id => normalizedPool.includes(id));

      if (adAccountIds.length === 0) {
        return NextResponse.json({
          campaigns: [],
          total: 0,
          errors: ['Unauthorized: Selected ad accounts are not in your subscription pool'],
          accountsIncluded: 0,
        });
      }
    }

    // Meta Account Integrity Compliance: Use ONLY user's own tokens
    const { getUserTokensOnly } = await import('@/lib/facebook/user-tokens-only');
    const tokens = await getUserTokensOnly(session);

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected', campaigns: [] },
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

    const modeParam = searchParams.get('mode');
    const effectiveMode = modeParam || (adAccountIds.length > getLiteModeThreshold(plan) ? 'lite' : undefined);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const limitParam = searchParams.get('limit');
    // const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || 50)) : 50;
    // const offsetParam = searchParams.get('offset');
    // const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
    const usePaginated = false; // typeof limit === 'number' && limit <= 500;

    const CACHE_VERSION = 'v3';
    const dateRangeKey = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : 'all';
    const cacheKey = generateCacheKey(
      `meta:campaigns:${CACHE_VERSION}`,
      session.user.id!,
      `${adAccountIds.sort().join(',')}:${dateRangeKey}:${effectiveMode || 'full'}:${usePaginated ? 'fp' : 'all'}`
    );

    if (forceRefresh) {
      await deleteCache(cacheKey);
      await deleteCache(`${cacheKey}:meta`);
    }

    const STALE_TTL = 3600;
    const result = await withCacheSWR(
      cacheKey,
      CacheTTL.CAMPAIGNS_LIST,
      STALE_TTL,
      async () => {
        const chunkSize = getDynamicChunkSize(adAccountIds.length);
        const chunkDelayMs = getDynamicChunkDelayMs(adAccountIds.length);
        return await fetchCampaignsFromMeta(adAccountIds, tokens, dateFrom, dateTo, effectiveMode, usePaginated, chunkSize, chunkDelayMs, searchParams.get('status'));
      }
    );

    // withCacheSWR returns { data, isStale, revalidating } – use result.data
    const data = result?.data ?? { campaigns: [], errors: [] };
    const campaigns = data.campaigns ?? [];
    const errors = data.errors ?? [];

    return NextResponse.json({
      campaigns,
      total: campaigns.length,
      errors,
      accountsIncluded: adAccountIds.length,
      ...(requestedAccountCount > adAccountIds.length && { accountsTruncated: requestedAccountCount }),
    });

  } catch (error: any) {
    console.error('[campaigns] Global error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function defined OUTSIDE
async function fetchCampaignsFromMeta(
  adAccountIds: string[],
  tokens: TokenInfo[],
  dateFrom?: string | null,
  dateTo?: string | null,
  mode?: string | null,
  firstPageOnly = false,
  chunkSize = 10,
  chunkDelayMs = 100,
  statusParam?: string | null
) {
  const allCampaigns: any[] = [];
  const errors: string[] = [];

  // Build insights time range parameter (Meta does not support future dates - use last_30d when range is invalid)
  let insightsTimeRange = 'date_preset(last_30d)';
  if (dateFrom && dateTo && mode !== 'lite') {
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

    await Promise.all(chunk.map(async (adAccountId) => {
      try {
        const token = await getValidTokenForAdAccount(adAccountId, tokens);

        if (!token) {
          errors.push(`No valid access token found for account ${adAccountId}`);
          return;
        }

        let statuses = ["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "DISABLED"];

        if (statusParam === 'deleted') {
          statuses = ["DELETED"];
        } else if (['archived', 'completed'].includes(statusParam || '')) {
          statuses = ["ARCHIVED"];
        }

        const filtering = encodeURIComponent(JSON.stringify([{ field: "effective_status", operator: "IN", value: statuses }]));

        // Check if explicit param requested, else use default filtering
        // If statusParam is 'all' or undefined, we use the broad list.

        if (mode === 'lite') {
          const initialUrl = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=id,name,status,effective_status,configured_status,created_time&limit=200&filtering=${filtering}&access_token=${token}`;
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

          const campaigns = await fetchAllPages(initialUrl, token);

          const formatted = campaigns.map((campaign: any) => ({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            effectiveStatus: campaign.effective_status,
            createdAt: new Date(campaign.created_time),
            metrics: { spend: 0, messages: 0, results: 0, costPerResult: 0 },
            adAccountId: adAccountId,
            currency: 'USD'
          }));
          allCampaigns.push(...formatted);
          return;
        }

        const [accountResponse] = await Promise.all([
          fetch(
            `https://graph.facebook.com/v22.0/${adAccountId}?fields=currency&access_token=${token}`
          )
        ]);

        const initialUrl = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=id,name,status,effective_status,configured_status,objective,daily_budget,lifetime_budget,spend_cap,issues_info,adsets{effective_status,ads{effective_status}},created_time,insights.${insightsTimeRange}{spend,actions,cost_per_action_type,reach,impressions,clicks}&limit=200&filtering=${filtering}&access_token=${token}`;

        console.log(`[campaigns] Fetching for ${adAccountId} URL: ${initialUrl}`);

        const fetchAllPages = async (url: string, token: string) => {
          let data: any[] = [];
          let nextUrl = url;
          while (nextUrl) {
            const res = await fetch(nextUrl);
            if (!res.ok) {
              const txt = await res.text();
              console.error(`[campaigns] Error fetching ${nextUrl}: ${res.status} ${txt}`);
              throw new Error(txt);
            }
            const json = await res.json();
            if (json.data) data.push(...json.data);
            nextUrl = json.paging?.next;
          }
          return data;
        };

        const campaigns = await fetchAllPages(initialUrl, token);
        console.log(`[campaigns] Fetched ${campaigns.length} campaigns for ${adAccountId}`);

        let accountCurrency = 'USD';
        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          accountCurrency = accountData.currency || 'USD';
        }

        const formatted = campaigns.map((campaign: any) => {
          const insights = campaign.insights?.data?.[0];
          const messageAction = insights?.actions?.find((a: any) =>
            a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
          );
          const messages = parseInt(messageAction?.value || '0');
          const spend = parseFloat(insights?.spend || '0');

          const postEngagementAction = insights?.actions?.find((a: any) =>
            a.action_type === 'post_engagement'
          );
          const postEngagements = parseInt(postEngagementAction?.value || '0');

          const messagingContactsAction = insights?.actions?.find((a: any) =>
            a.action_type === 'onsite_conversion.messaging_first_reply'
          );
          const messagingContacts = parseInt(messagingContactsAction?.value || '0');

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
        console.error(`[campaigns] Error for account ${adAccountId}:`, err);
        errors.push(`Error for account ${adAccountId}: ${err.message}`);
      }
    }));

    if (i + chunkSize < adAccountIds.length) {
      await new Promise(resolve => setTimeout(resolve, chunkDelayMs));
    }
  }

  // Sort by latest created
  allCampaigns.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { campaigns: allCampaigns, errors };
}
