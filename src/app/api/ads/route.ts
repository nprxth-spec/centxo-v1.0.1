import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { withCache, withCacheSWR, generateCacheKey, CacheTTL, deleteCache } from '@/lib/cache/redis';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';

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
      console.log('[ads] User is team member, fetching owner tokens from:', teamOwnerId);
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
        { error: 'Facebook not connected', ads: [] },
        { status: 400 }
      );
    }

    const forceRefresh = searchParams.get('refresh') === 'true';
    const CACHE_VERSION = 'v1';
    const dateRangeKey = dateFrom && dateTo ? `${dateFrom}_${dateTo}` : 'all';
    const cacheKey = generateCacheKey(`meta:ads:${CACHE_VERSION}`, session.user.id!, `${adAccountIds.sort().join(',')}:${dateRangeKey}`);

    if (forceRefresh) {
      await deleteCache(cacheKey);
      await deleteCache(`${cacheKey}:meta`);
    }

    // SWR caching: 5 min fresh, 1 hour stale
    const STALE_TTL = 3600;
    const result = await withCacheSWR(
      cacheKey,
      CacheTTL.ADS_LIST,
      STALE_TTL,
      async () => {
        return await fetchAdsFromMeta(adAccountIds, tokens, dateFrom, dateTo, forceRefresh);
      }
    );

    return NextResponse.json({
      ads: result.data,
      count: result.data.length,
      isStale: result.isStale,
    });
  } catch (error) {
    console.error('Error in GET /api/ads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ads', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

const ADS_PAGE_RETRIES = 3;
const ADS_PAGE_RETRY_DELAY_MS = 800;

async function fetchOnePage(url: string): Promise<{ data: any[]; next: string | null }> {
  for (let attempt = 1; attempt <= ADS_PAGE_RETRIES; attempt++) {
    const res = await fetch(url);
    const data: any = await res.json().catch(() => ({}));

    if (data.error) {
      const msg = data.error?.error_user_msg || data.error?.message || 'Unknown';
      if (attempt < ADS_PAGE_RETRIES && (res.status >= 500 || res.status === 429)) {
        console.warn(`[ads] Meta API error (attempt ${attempt}/${ADS_PAGE_RETRIES}): ${msg}. Retrying in ${ADS_PAGE_RETRY_DELAY_MS}ms...`);
        await new Promise((r) => setTimeout(r, ADS_PAGE_RETRY_DELAY_MS));
        continue;
      }
      throw new Error(msg);
    }

    if (!res.ok) {
      if (attempt < ADS_PAGE_RETRIES && (res.status >= 500 || res.status === 429)) {
        console.warn(`[ads] Meta API HTTP ${res.status} (attempt ${attempt}/${ADS_PAGE_RETRIES}). Retrying...`);
        await new Promise((r) => setTimeout(r, ADS_PAGE_RETRY_DELAY_MS));
        continue;
      }
      throw new Error(`Failed to fetch page: ${res.status} ${res.statusText}`);
    }

    const items = Array.isArray(data.data) ? data.data : [];
    const next = typeof data.paging?.next === 'string' ? data.paging.next : null;
    return { data: items, next };
  }

  throw new Error('Failed to fetch page after retries');
}

const ADS_MAX_PAGES_PER_ACCOUNT = 5;

async function fetchAllPages(initialUrl: string, _token: string): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = initialUrl;
  let pageCount = 0;

  while (nextUrl && pageCount < ADS_MAX_PAGES_PER_ACCOUNT) {
    try {
      const { data: pageData, next } = await fetchOnePage(nextUrl);
      allData.push(...pageData);
      nextUrl = next;
      pageCount++;
    } catch (error) {
      console.error('[ads] Error fetching page:', error instanceof Error ? error.message : error);
      nextUrl = null;
    }
  }

  return allData;
}

async function fetchAdsFromMeta(adAccountIds: string[], tokens: TokenInfo[], dateFrom?: string | null, dateTo?: string | null, forceRefresh = false) {
  const allAds: any[] = [];

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
  const CHUNK_SIZE = 5; // Reduced for safety

  for (let i = 0; i < adAccountIds.length; i += CHUNK_SIZE) {
    const chunk = adAccountIds.slice(i, i + CHUNK_SIZE);

    await Promise.all(chunk.map(async (accountId) => {
      // Use helper to find correct token (uses Redis cache)
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

        const initialUrl = `https://graph.facebook.com/v22.0/${accountId}/ads?fields=id,name,status,adset_id,campaign_id,adset{name,targeting,daily_budget,lifetime_budget},campaign{name,daily_budget,lifetime_budget},creative{id,name,title,body,image_url,thumbnail_url,object_story_spec,asset_feed_spec,effective_object_story_id,object_story_id,actor_id},effective_status,configured_status,issues_info,created_time,insights.${insightsTimeRange}{spend,actions,reach,impressions,clicks}&limit=200&access_token=${token}`;

        const ads = await fetchAllPages(initialUrl, token);

        // Add account ID and currency to each ad
        const adsWithAccount = ads.map((ad: any) => ({
          ...ad,
          adAccountId: accountId,
          currency: accountCurrency,
        }));

        allAds.push(...adsWithAccount);

      } catch (err) {
        console.error(`Error fetching ads for account ${accountId}:`, err);
      }
    }));

    if (i + CHUNK_SIZE < adAccountIds.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const extractPageId = (ad: any): string | null => {
    const c = ad.creative;
    if (!c) return null;
    // actor_id = Page ID for page post ads (Meta Marketing API)
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

  // Build pageId -> adAccountId map (token that can access ad account can usually access its page)
  const pageIdToAdAccount = new Map<string, string>();
  allAds.forEach((ad: any) => {
    const pid = extractPageId(ad);
    const accId = ad.adAccountId;
    if (pid && accId && !pageIdToAdAccount.has(pid)) {
      pageIdToAdAccount.set(pid, accId);
    }
  });

  const pageIds = new Set(pageIdToAdAccount.keys());

  // Batch fetch page names + usernames - use Meta ids param to reduce API calls (1 call per ~50 pages vs N calls)
  type PageInfo = { name: string; username?: string };
  const pageInfoCache: Record<string, string | PageInfo> = {};
  if (pageIds.size > 0) {
    const pageIdsArray = Array.from(pageIds);
    const pageInfoCacheKey = generateCacheKey('meta:pages', pageIdsArray.sort().join(','));
    if (forceRefresh) await deleteCache(pageInfoCacheKey);

    const cached = await withCache(
      pageInfoCacheKey,
      CacheTTL.PAGE_NAMES,
      async (): Promise<Record<string, PageInfo>> => {
        const info: Record<string, PageInfo> = {};

        // Group pageIds by adAccountId (same token per ad account)
        const adAccountToPageIds = new Map<string, string[]>();
        for (const pageId of pageIdsArray) {
          const adAccountId = pageIdToAdAccount.get(pageId);
          if (!adAccountId) continue;
          if (!adAccountToPageIds.has(adAccountId)) adAccountToPageIds.set(adAccountId, []);
          adAccountToPageIds.get(adAccountId)!.push(pageId);
        }

        const IDS_PER_REQUEST = 50; // Meta API limit
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
            } catch {
              /* ignore */
            }
          }
        }
        return info;
      }
    );

    Object.assign(pageInfoCache, cached);
  }

  const getPageInfo = (pageId: string): { name: string | null; username: string | null } => {
    const v = pageInfoCache[pageId];
    if (!v) return { name: null, username: null };
    if (typeof v === 'string') return { name: v, username: null };
    return { name: v.name || null, username: v.username ?? null };
  };

  // Format ads for display - now using cached page names
  const formattedAds = allAds.map((ad) => {
    // Try to get image URL from multiple sources
    let imageUrl = null;

    if (ad.creative) {
      // 1. Try thumbnail_url first (most reliable)
      imageUrl = ad.creative.thumbnail_url || ad.creative.image_url;

      // 2. Try asset_feed_spec (Dynamic Creative)
      if (!imageUrl && ad.creative.asset_feed_spec) {
        const spec = ad.creative.asset_feed_spec;
        if (spec.images && spec.images.length > 0) {
          imageUrl = spec.images[0].url;
        } else if (spec.videos && spec.videos.length > 0) {
          imageUrl = spec.videos[0].thumbnail_url;
        }
      }

      // 3. Try object_story_spec
      if (!imageUrl && ad.creative.object_story_spec) {
        const spec = ad.creative.object_story_spec;

        // Carousel ads (child_attachments)
        if (spec.link_data?.child_attachments && spec.link_data.child_attachments.length > 0) {
          imageUrl = spec.link_data.child_attachments[0].picture;
        }
        // Standards ads
        else if (spec.link_data?.picture) {
          imageUrl = spec.link_data.picture;
        } else if (spec.photo_data?.url) {
          imageUrl = spec.photo_data.url;
        } else if (spec.video_data?.image_url) {
          imageUrl = spec.video_data.image_url;
        }
      }
    }

    let pageId: string | null = extractPageId(ad);
    let pageName: string | null = null;
    let pageUsername: string | null = null;
    if (pageId) {
      const info = getPageInfo(pageId);
      pageName = info.name;
      pageUsername = info.username;
    }
    const storyId = ad.creative?.object_story_id || ad.creative?.effective_object_story_id || null;

    // Extract metrics from insights
    const insights = ad.insights?.data?.[0];
    const spend = parseFloat(insights?.spend || '0');

    // Extract messaging contacts from actions
    const actions = insights?.actions || [];
    const messagingContactsAction = actions.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');
    const messagingContacts = parseInt(messagingContactsAction?.value || '0');

    const postEngagementAction = actions.find((a: any) => a.action_type === 'post_engagement');
    const postEngagements = parseInt(postEngagementAction?.value || '0');

    // Get Budget - Campaign level (CBO) or Ad Set level
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
