import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { withCache, withCacheSWR, generateCacheKey, CacheTTL, deleteCache } from '@/lib/cache/redis';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { getApiAccountCap, getDynamicChunkSize, getDynamicChunkDelayMs } from '@/lib/plan-limits';
import { MAX_ACCOUNTS_PER_REQUEST } from '@/lib/meta-quota-config';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

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

    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

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
        { error: 'Facebook not connected', ads: [] },
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
    const usePaginated = false;

    const CACHE_VERSION = 'v2';
    const dateRangeKey = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : 'all';
    const cacheKey = generateCacheKey(
      `meta:ads:${CACHE_VERSION}`,
      session.user.id!,
      `${adAccountIds.slice().sort().join(',')}:${dateRangeKey}:${usePaginated ? 'fp' : 'all'}:${statusParam || 'all'}`
    );

    if (forceRefresh) {
      await deleteCache(cacheKey);
      await deleteCache(`${cacheKey}:meta`);
    }

    const STALE_TTL = 3600;
    const result = await withCacheSWR(
      cacheKey,
      CacheTTL.ADS_LIST,
      STALE_TTL,
      async () => {
        const chunkSize = getDynamicChunkSize(adAccountIds.length);
        const chunkDelayMs = getDynamicChunkDelayMs(adAccountIds.length);
        return await fetchAdsFromMeta(adAccountIds, tokens, dateFrom, dateTo, statusParam, forceRefresh, usePaginated, chunkSize, chunkDelayMs);
      }
    );

    // withCacheSWR returns { data, isStale, revalidating }
    const allAds = Array.isArray(result?.data) ? result.data : [];
    const total = allAds.length;
    return NextResponse.json({
      ads: allAds,
      total,
      accountsIncluded: adAccountIds.length,
      ...(requestedAccountCount > adAccountIds.length && { accountsTruncated: requestedAccountCount }),
    });

  } catch (error: any) {
    console.error('[ads] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function fetchAdsFromMeta(
  adAccountIds: string[],
  tokens: TokenInfo[],
  dateFrom?: string | null,
  dateTo?: string | null,
  statusParam?: string | null,
  forceRefresh = false,
  firstPageOnly = false,
  chunkSize = 10,
  chunkDelayMs = 100
) {
  const allAds: any[] = [];

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

  const ADS_PAGE_RETRIES = 3;
  const ADS_PAGE_RETRY_DELAY_MS = 800;

  const fetchOnePage = async (pageUrl: string): Promise<{ data: any[]; next: string | null }> => {
    for (let attempt = 1; attempt <= ADS_PAGE_RETRIES; attempt++) {
      const res = await fetch(pageUrl);
      const json: any = await res.json().catch(() => ({}));
      if (json.error) {
        const msg = json.error?.error_user_msg || json.error?.message || 'Unknown';
        if (attempt < ADS_PAGE_RETRIES && (res.status >= 500 || res.status === 429)) {
          await new Promise((r) => setTimeout(r, ADS_PAGE_RETRY_DELAY_MS));
          continue;
        }
        throw new Error(msg);
      }
      if (!res.ok) {
        if (attempt < ADS_PAGE_RETRIES && (res.status >= 500 || res.status === 429)) {
          await new Promise((r) => setTimeout(r, ADS_PAGE_RETRY_DELAY_MS));
          continue;
        }
        throw new Error(`Failed to fetch page: ${res.status}`);
      }
      const items = Array.isArray(json.data) ? json.data : [];
      const next = typeof json.paging?.next === 'string' ? json.paging.next : null;
      return { data: items, next };
    }
    throw new Error('Failed to fetch page after retries');
  };

  // Fetch all pages (no cap) so ad count matches ad sets / campaigns
  const fetchAllPages = async (initialUrl: string, _token: string): Promise<any[]> => {
    const allData: any[] = [];
    let nextUrl: string | null = initialUrl;
    while (nextUrl) {
      try {
        const { data: pageData, next } = await fetchOnePage(nextUrl);
        allData.push(...pageData);
        nextUrl = next;
      } catch (err) {
        console.warn('[ads] Page fetch error:', err instanceof Error ? err.message : err);
        nextUrl = null;
      }
    }
    return allData;
  };

  for (let i = 0; i < adAccountIds.length; i += chunkSize) {
    const chunk = adAccountIds.slice(i, i + chunkSize);

    await Promise.all(chunk.map(async (accountId) => {
      const token = await getValidTokenForAdAccount(accountId, tokens);

      if (!token) {
        return;
      }

      try {
        const accountResponse = await fetch(
          `https://graph.facebook.com/v22.0/${accountId}?fields=currency&access_token=${token}`
        );

        if (!accountResponse.ok) {
          console.warn(`[ads] Account ${accountId} fetch failed: ${accountResponse.status}`);
          return;
        }

        const accountData = await accountResponse.json();
        const accountCurrency = accountData.currency || 'USD';

        let statuses = ["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "DISABLED"];

        if (statusParam === 'deleted') {
          statuses = ["DELETED"];
        } else if (['archived', 'completed'].includes(statusParam || '')) {
          statuses = ["ARCHIVED"];
        }

        const filtering = encodeURIComponent(JSON.stringify([{ field: "effective_status", operator: "IN", value: statuses }]));

        const initialUrl = `https://graph.facebook.com/v22.0/${accountId}/ads?fields=id,name,status,adset_id,campaign_id,adset{name,targeting,daily_budget,lifetime_budget},campaign{name,daily_budget,lifetime_budget},creative{id,name,title,body,image_url,thumbnail_url,object_story_spec,asset_feed_spec,effective_object_story_id,object_story_id,actor_id},effective_status,configured_status,issues_info,created_time,insights.${insightsTimeRange}{spend,actions,reach,impressions,clicks}&limit=200&filtering=${filtering}&access_token=${token}`;

        const ads = await fetchAllPages(initialUrl, token);

        const adsWithAccount = ads.map((ad: any) => ({
          ...ad,
          adAccountId: accountId,
          currency: accountCurrency,
        }));

        allAds.push(...adsWithAccount);

      } catch (err) {
        console.error(`[ads] Error fetching for account ${accountId}:`, err);
      }
    }));

    if (i + chunkSize < adAccountIds.length) {
      await new Promise(resolve => setTimeout(resolve, chunkDelayMs));
    }
  }

  const extractPageId = (ad: any): string | null => {
    const c = ad.creative;
    if (!c) return null;
    if (c.actor_id) return String(c.actor_id);
    const storyId = c.object_story_id || c.effective_object_story_id;
    if (storyId) {
      const parts = storyId.split('_');
      if (parts.length > 0 && parts[0]) return parts[0];
    }
    const spec = c.object_story_spec;
    if (spec?.page_id) return String(spec.page_id);
    if (spec?.link_data?.page_id) return String(spec.link_data.page_id);
    if (spec?.video_data?.page_id) return String(spec.video_data.page_id);
    if (spec?.photo_data?.page_id) return String(spec.photo_data.page_id);
    return null;
  };

  const pageIdToAdAccount = new Map<string, string>();
  allAds.forEach((ad: any) => {
    const pid = extractPageId(ad);
    const accId = ad.adAccountId;
    if (pid && accId && !pageIdToAdAccount.has(pid)) {
      pageIdToAdAccount.set(pid, accId);
    }
  });

  const pageIds = new Set(pageIdToAdAccount.keys());
  type PageInfo = { name: string; username?: string };
  const pageInfoCache: Record<string, string | PageInfo> = {};

  if (pageIds.size > 0) {
    const pageIdsArray = Array.from(pageIds);
    const pageInfoCacheKey = generateCacheKey('meta:pages', pageIdsArray.slice().sort().join(','));
    if (forceRefresh) await deleteCache(pageInfoCacheKey);

    try {
      const cached = await withCache(
        pageInfoCacheKey,
        CacheTTL.PAGE_NAMES,
        async (): Promise<Record<string, PageInfo>> => {
          const info: Record<string, PageInfo> = {};
          const adAccountToPageIds = new Map<string, string[]>();
          for (const pageId of pageIdsArray) {
            const adAccountId = pageIdToAdAccount.get(pageId);
            if (!adAccountId) continue;
            if (!adAccountToPageIds.has(adAccountId)) adAccountToPageIds.set(adAccountId, []);
            adAccountToPageIds.get(adAccountId)!.push(pageId);
          }

          const IDS_PER_REQUEST = 50;
          for (const [adAccountId, ids] of adAccountToPageIds) {
            const token = await getValidTokenForAdAccount(adAccountId, tokens);
            if (!token) continue;
            for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
              const chunk = ids.slice(i, i + IDS_PER_REQUEST);
              const idsParam = chunk.join(',');
              try {
                const res = await fetch(
                  `https://graph.facebook.com/v22.0/?ids=${encodeURIComponent(idsParam)}&fields=name,username&access_token=${token}`
                );
                if (res.ok) {
                  const data = await res.json();
                  for (const pageId of chunk) {
                    const pageData = data[pageId];
                    if (pageData && !pageData.error) {
                      const name = pageData.name ?? '';
                      const username = pageData.username;
                      if (name) info[pageId] = { name, username };
                    }
                  }
                }
              } catch { /* ignore */ }
            }
          }
          return info;
        }
      );
      Object.assign(pageInfoCache, cached);
    } catch (e) {
      console.warn('[ads] Page names cache failed:', e);
    }
  }

  const getPageInfo = (pageId: string): { name: string | null; username: string | null } => {
    const v = pageInfoCache[pageId];
    if (!v) return { name: null, username: null };
    if (typeof v === 'string') return { name: v, username: null };
    return { name: v.name || null, username: v.username ?? null };
  };

  const formattedAds = allAds.map((ad) => {
    let imageUrl: string | null = null;
    if (ad.creative) {
      imageUrl = ad.creative.thumbnail_url || ad.creative.image_url;
      if (!imageUrl && ad.creative.asset_feed_spec) {
        const spec = ad.creative.asset_feed_spec;
        if (spec.images?.length > 0) imageUrl = spec.images[0].url;
        else if (spec.videos?.length > 0) imageUrl = spec.videos[0].thumbnail_url;
      }
      if (!imageUrl && ad.creative.object_story_spec) {
        const spec = ad.creative.object_story_spec;
        if (spec.link_data?.child_attachments?.length > 0) imageUrl = spec.link_data.child_attachments[0].picture;
        else if (spec.link_data?.picture) imageUrl = spec.link_data.picture;
        else if (spec.photo_data?.url) imageUrl = spec.photo_data.url;
        else if (spec.video_data?.image_url) imageUrl = spec.video_data.image_url;
      }
    }

    const pageId = extractPageId(ad);
    let pageName: string | null = null;
    let pageUsername: string | null = null;
    if (pageId) {
      const info = getPageInfo(pageId);
      pageName = info.name;
      pageUsername = info.username;
    }
    const storyId = ad.creative?.object_story_id || ad.creative?.effective_object_story_id || null;
    const insights = ad.insights?.data?.[0];
    const spend = parseFloat(insights?.spend || '0');
    const actions = insights?.actions || [];
    const messagingContactsAction = actions.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
    const messagingContacts = parseInt(messagingContactsAction?.value || '0');
    const postEngagementAction = actions.find((a: any) => a.action_type === 'post_engagement');
    const postEngagements = parseInt(postEngagementAction?.value || '0');

    const campaignDaily = ad.campaign?.daily_budget ? parseFloat(ad.campaign.daily_budget) / 100 : 0;
    const campaignLifetime = ad.campaign?.lifetime_budget ? parseFloat(ad.campaign.lifetime_budget) / 100 : 0;
    const adsetDaily = ad.adset?.daily_budget ? parseFloat(ad.adset.daily_budget) / 100 : 0;
    const adsetLifetime = ad.adset?.lifetime_budget ? parseFloat(ad.adset.lifetime_budget) / 100 : 0;

    let budget = 0;
    let budgetSource: 'campaign' | 'adset' = 'adset';
    let budgetType: 'daily' | 'lifetime' = 'daily';

    if (campaignDaily > 0 || campaignLifetime > 0) {
      budget = campaignDaily > 0 ? campaignDaily : campaignLifetime;
      budgetSource = 'campaign';
      budgetType = campaignDaily > 0 ? 'daily' : 'lifetime';
    } else if (adsetDaily > 0 || adsetLifetime > 0) {
      budget = adsetDaily > 0 ? adsetDaily : adsetLifetime;
      budgetSource = 'adset';
      budgetType = adsetDaily > 0 ? 'daily' : 'lifetime';
    }

    return {
      id: ad.id,
      name: ad.name,
      status: ad.status,
      effectiveStatus: ad.effective_status,
      configuredStatus: ad.configured_status,
      issuesInfo: ad.issuesInfo || [],
      adsetId: ad.adset_id,
      campaignId: ad.campaign_id,
      campaignName: ad.campaign?.name || null,
      adSetName: ad.adset?.name || null,
      creativeId: ad.creative?.id || '-',
      creativeName: ad.creative?.name || '-',
      title: ad.creative?.title || '-',
      body: ad.creative?.body || '-',
      imageUrl: imageUrl,
      targeting: ad.adset?.targeting || null,
      createdAt: ad.created_time,
      adAccountId: ad.adAccountId,
      currency: ad.currency,
      pageId: pageId,
      pageName: pageName || (pageId ? `Page ${pageId}` : null),
      pageUsername: pageUsername,
      budget: budget,
      budgetSource: budgetSource,
      budgetType: budgetType,
      campaignDailyBudget: campaignDaily,
      campaignLifetimeBudget: campaignLifetime,
      adsetDailyBudget: adsetDaily,
      adsetLifetimeBudget: adsetLifetime,
      metrics: {
        spend: spend,
        reach: parseInt(insights?.reach || '0'),
        impressions: parseInt(insights?.impressions || '0'),
        clicks: parseInt(insights?.clicks || '0'),
        messagingContacts: messagingContacts,
        results: messagingContacts,
        costPerResult: messagingContacts > 0 ? spend / messagingContacts : 0,
        postEngagements: postEngagements,
        amountSpent: spend
      },
      postLink: storyId ? `https://www.facebook.com/${storyId}` : null,
    };
  });

  return formattedAds;
}
