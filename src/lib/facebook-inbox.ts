/**
 * Facebook Graph API for Inbox
 */

const PAGE_TOKEN_CACHE_TTL = 55 * 60 * 1000; // 55 min - reduce gr:get:Page
declare global {
  var _inboxPageTokenCache: Record<string, { token: string; ts: number }> | undefined;
}
const pageTokenCache = globalThis._inboxPageTokenCache ?? {};
if (typeof globalThis !== 'undefined') globalThis._inboxPageTokenCache = pageTokenCache;

export async function getPageAccessToken(userAccessToken: string | null, pageId: string): Promise<string> {
  const key = pageId;
  const c = pageTokenCache[key];
  if (c && Date.now() - c.ts < PAGE_TOKEN_CACHE_TTL) return c.token;

  if (!userAccessToken) {
    throw new Error('No access token available to fetch page token');
  }

  const pageRes = await fetch(
    `https://graph.facebook.com/v22.0/${pageId}?fields=access_token&access_token=${userAccessToken}`
  );
  const pageData = await pageRes.json();
  if (pageData.error) throw new Error(pageData.error.message);
  const token = pageData.access_token;
  pageTokenCache[key] = { token, ts: Date.now() };
  return token;
}

export async function getPages(accessToken: string) {
  const allPages: Array<{ id: string; name: string; access_token?: string; picture?: { data?: { url?: string } }; tasks?: string[] }> = [];
  let nextUrl: string | null = `https://graph.facebook.com/v22.0/me/accounts?fields=name,id,access_token,picture{url},tasks&limit=100&access_token=${accessToken}`;

  while (nextUrl) {
    const response: Response = await fetch(nextUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (data.data) {
      allPages.push(...data.data);
    }

    nextUrl = data.paging?.next || null;
  }

  return allPages;
}

export async function getPageConversations(
  userAccessToken: string | null,
  pageId: string,
  pageAccessToken?: string
) {
  let token = pageAccessToken;
  if (!token) token = await getPageAccessToken(userAccessToken, pageId);

  const fetchConversations = async (includeLabels: boolean) => {
    let fields =
      'snippet,updated_time,participants{id,name,email,username,link,picture},message_count,unread_count,link';
    if (includeLabels) fields += ',labels';

    let allConversations: Array<Record<string, unknown>> = [];
    let url: string | null = `https://graph.facebook.com/v22.0/${pageId}/conversations?fields=${fields}&platform=messenger&limit=50&access_token=${token}`;
    let pageCount = 0;
    const maxPages = 5; // up to ~250 conversations

    while (url && pageCount < maxPages) {
      const response: Response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        // If labels field not supported (UnifiedThread), retry without labels
        if (includeLabels && (data.error.code === 100 || data.error.code === 2)) {
          throw new Error(data.error.code === 2 && data.error.error_subcode === 2018344
            ? 'TOS_REQUIRED'
            : 'LABELS_NOT_SUPPORTED');
        }
        throw new Error(data.error?.message || 'Failed to fetch conversations');
      }

      const batch = (data.data || []).map((conv: Record<string, unknown>) => {
        let adId: string | null = null;
        // Extract ad_id from labels (if available)
        const labels = conv.labels as { data?: Array<{ name?: string }> } | undefined;
        if (labels?.data) {
          const adLabel = labels.data.find((l) => l.name?.startsWith('ad_id.'));
          if (adLabel?.name) {
            const parts = adLabel.name.split('.');
            adId = parts.length > 1 ? parts[1] : null;
          }
        }
        // Extract ad_id from conversation link
        if (!adId && typeof conv.link === 'string') {
          const match = conv.link.match(/ad_id=(\d+)/);
          if (match) adId = match[1];
        }
        return { ...conv, ad_id: adId };
      });
      allConversations = allConversations.concat(batch);
      url = data.paging?.next || null;
      pageCount++;
    }

    return allConversations;
  };

  try {
    let conversations = await fetchConversations(true);
    const withoutAdId = conversations.filter((c) => !(c as Record<string, unknown>).ad_id);
    if (withoutAdId.length > 0) {
      conversations = await enrichConversationsWithAdIdLabels(token, conversations);
    }
    return conversations;
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === 'TOS_REQUIRED' || e.message === 'LABELS_NOT_SUPPORTED')) {
      // Labels not supported (UnifiedThread) or TOS required - fetch without labels
      let conversations = await fetchConversations(false);
      // Still try enrichment for conversations without ad_id (link-only enrichment)
      const withoutAdId = conversations.filter((c) => !(c as Record<string, unknown>).ad_id);
      if (withoutAdId.length > 0) {
        conversations = await enrichConversationsWithLink(token, conversations);
      }
      return conversations;
    }
    throw e;
  }
}

async function enrichConversationsWithAdIdLabels(
  token: string,
  conversations: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  const needLabels = conversations.filter((c) => !(c.ad_id as string));
  if (needLabels.length === 0) return conversations;

  const BATCH_SIZE = 50;
  const adIdByConvId = new Map<string, string | null>();

  for (let i = 0; i < needLabels.length; i += BATCH_SIZE) {
    const batch = needLabels.slice(i, i + BATCH_SIZE);
    const batchBody = batch.map((c) => ({
      method: 'GET' as const,
      relative_url: `${String(c.id)}?fields=labels,link`,
    }));

    try {
      const formData = new URLSearchParams();
      formData.set('batch', JSON.stringify(batchBody));
      formData.set('access_token', token);
      const batchRes = await fetch('https://graph.facebook.com/v22.0/', {
        method: 'POST',
        body: formData,
      });
      const batchData = (await batchRes.json()) as Array<{ code: number; body?: string }>;
      batch.forEach((c, idx) => {
        const resp = batchData[idx];
        if (!resp || resp.code !== 200 || !resp.body) return;
        try {
          const data = JSON.parse(resp.body) as { labels?: { data?: Array<{ name?: string }> }; link?: string };
          let adId: string | null = null;
          if (data.labels?.data) {
            const adLabel = data.labels.data.find((l) => l.name?.startsWith('ad_id.'));
            if (adLabel?.name) {
              const parts = adLabel.name.split('.');
              adId = parts.length > 1 ? parts[1] : null;
            }
          }
          if (!adId && typeof data.link === 'string') {
            const match = data.link.match(/ad_id=(\d+)/);
            if (match) adId = match[1];
          }
          if (adId) adIdByConvId.set(c.id as string, adId);
        } catch { }
      });
    } catch { }
  }

  return conversations.map((c) => {
    const adId = adIdByConvId.get(c.id as string) ?? (c.ad_id as string);
    return adId ? { ...c, ad_id: adId } : c;
  });
}

/**
 * Enrichment for UnifiedThread: only uses link field (not labels).
 * Uses batch API to check conversation link for ad_id parameter.
 */
async function enrichConversationsWithLink(
  token: string,
  conversations: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  const needAdId = conversations.filter((c) => !(c.ad_id as string));
  if (needAdId.length === 0) return conversations;

  const BATCH_SIZE = 50;
  const adIdByConvId = new Map<string, string>();

  for (let i = 0; i < needAdId.length; i += BATCH_SIZE) {
    const batch = needAdId.slice(i, i + BATCH_SIZE);
    const batchBody = batch.map((c) => ({
      method: 'GET' as const,
      relative_url: `${String(c.id)}?fields=link`,
    }));

    try {
      const formData = new URLSearchParams();
      formData.set('batch', JSON.stringify(batchBody));
      formData.set('access_token', token);
      const batchRes = await fetch('https://graph.facebook.com/v22.0/', {
        method: 'POST',
        body: formData,
      });
      const batchData = (await batchRes.json()) as Array<{ code: number; body?: string }>;
      batch.forEach((c, idx) => {
        const resp = batchData[idx];
        if (!resp || resp.code !== 200 || !resp.body) return;
        try {
          const data = JSON.parse(resp.body) as { link?: string };
          if (typeof data.link === 'string') {
            const match = data.link.match(/ad_id=(\d+)/);
            if (match) adIdByConvId.set(c.id as string, match[1]);
          }
        } catch { /* ignore parse errors */ }
      });
    } catch { /* ignore batch errors */ }
  }

  if (adIdByConvId.size > 0) {
    console.log(`[getPageConversations] Found ${adIdByConvId.size} conversations with ad_id from link`);
  }

  return conversations.map((c) => {
    const adId = adIdByConvId.get(c.id as string) ?? (c.ad_id as string);
    return adId ? { ...c, ad_id: adId } : c;
  });
}

export async function getConversationMessages(
  userAccessToken: string | null,
  conversationId: string,
  pageId: string,
  pageAccessToken?: string
) {
  let token = pageAccessToken;
  if (!token) token = await getPageAccessToken(userAccessToken, pageId);

  let allMessages: Array<Record<string, unknown>> = [];
  let url: string | null = `https://graph.facebook.com/v22.0/${conversationId}/messages?fields=message,from{id,name,picture},created_time,attachments{type,image_data,file_url,payload},sticker&limit=20&access_token=${token}`;
  let pageCount = 0;
  const maxPages = 25; // ~500 messages

  while (url && pageCount < maxPages) {
    const response: Response = await fetch(url);
    const data = await response.json();

    if (data.error) break;
    if (data.data?.length) allMessages = allMessages.concat(data.data);
    url = data.paging?.next || null;
    pageCount++;
  }

  return allMessages.reverse();
}

export async function sendMessage(
  userAccessToken: string | null,
  pageId: string,
  recipientId: string,
  messageText: string,
  options?: {
    messagingType?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
    tag?: 'HUMAN_AGENT' | 'CUSTOMER_FEEDBACK';
    pageAccessToken?: string;
  }
) {
  const pageAccessToken = options?.pageAccessToken || await getPageAccessToken(userAccessToken, pageId);

  const payload: Record<string, unknown> = {
    recipient: { id: recipientId },
    message: { text: messageText },
    messaging_type: options?.messagingType || 'RESPONSE',
  };

  // Add tag if using MESSAGE_TAG
  if (options?.messagingType === 'MESSAGE_TAG' && options?.tag) {
    payload.tag = options.tag;
  }

  const response: Response = await fetch(
    `https://graph.facebook.com/v22.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result;
}

// ════════════════════════════════════════════════════════════════════
// Marketing API – Find messaging ads targeting a specific page
// ════════════════════════════════════════════════════════════════════

export interface PageAd {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  body: string | null;
  title: string | null;
  effectiveStatus: string;
}

// In-memory cache – 30 min TTL
const MKT_ADS_CACHE_TTL = 30 * 60 * 1000;
declare global {
  // eslint-disable-next-line no-var
  var _mktPageAdsCache: Record<string, { ads: PageAd[]; ts: number }> | undefined;
}
const mktPageAdsCache = globalThis._mktPageAdsCache ?? {};
if (typeof globalThis !== 'undefined') globalThis._mktPageAdsCache = mktPageAdsCache;

/**
 * Scan all accessible ad accounts for ads that direct messaging to `pageId`.
 * Checks `adset.promoted_object.page_id` (Click-to-Messenger ads)
 * and also `creative.object_story_spec.page_id` / `creative.actor_id` as fallbacks.
 */
export async function findMessagingAdsForPage(
  userAccessToken: string,
  pageId: string
): Promise<PageAd[]> {
  const cacheKey = `mkt_${pageId}`;
  const cached = mktPageAdsCache[cacheKey];
  if (cached && Date.now() - cached.ts < MKT_ADS_CACHE_TTL) {
    return cached.ads;
  }

  console.log(`[findMessagingAdsForPage] Scanning ad accounts for page ${pageId}…`);

  // 1. Fetch all ad accounts
  let allAccounts: Array<{ id: string; account_status: number }> = [];
  let nextUrl: string | null =
    `https://graph.facebook.com/v22.0/me/adaccounts?fields=id,account_status&limit=200&access_token=${userAccessToken}`;
  while (nextUrl) {
    try {
      const res: Response = await fetch(nextUrl);
      const data = await res.json();
      if (data.error || !data.data) break;
      allAccounts = allAccounts.concat(data.data);
      nextUrl = data.paging?.next || null;
    } catch {
      break;
    }
  }

  const activeAccounts = allAccounts.filter((a) => a.account_status === 1);
  console.log(
    `[findMessagingAdsForPage] ${activeAccounts.length} active / ${allAccounts.length} total accounts`
  );

  const matchingAds: PageAd[] = [];
  const seenAdIds = new Set<string>();
  const BATCH = 5;

  for (let i = 0; i < activeAccounts.length; i += BATCH) {
    const batch = activeAccounts.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (account) => {
        try {
          // Query adsets with promoted_object + nested ads+creative
          const fields = encodeURIComponent(
            'id,promoted_object,ads{id,name,effective_status,creative{thumbnail_url,image_url,body,title,object_story_spec,actor_id}}'
          );
          const statuses = encodeURIComponent('["ACTIVE","PAUSED"]');
          const url = `https://graph.facebook.com/v22.0/${account.id}/adsets?fields=${fields}&effective_status=${statuses}&limit=100&access_token=${userAccessToken}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.error || !data.data) return;

          for (const adset of data.data as Array<Record<string, unknown>>) {
            const po = adset.promoted_object as { page_id?: string } | undefined;
            const poMatch = po?.page_id === pageId;

            const ads = (adset.ads as { data?: Array<Record<string, unknown>> })?.data || [];
            for (const ad of ads) {
              const cr = ad.creative as {
                thumbnail_url?: string;
                image_url?: string;
                body?: string;
                title?: string;
                object_story_spec?: { page_id?: string };
                actor_id?: string;
              } | undefined;
              const storyMatch = cr?.object_story_spec?.page_id === pageId;
              const actorMatch = cr?.actor_id === pageId;

              if (poMatch || storyMatch || actorMatch) {
                const adId = ad.id as string;
                if (seenAdIds.has(adId)) continue;
                seenAdIds.add(adId);
                matchingAds.push({
                  id: adId,
                  name: (ad.name as string) || 'Ad',
                  thumbnailUrl: cr?.thumbnail_url || null,
                  imageUrl: cr?.image_url || null,
                  body: cr?.body || null,
                  title: cr?.title || null,
                  effectiveStatus: (ad.effective_status as string) || 'UNKNOWN',
                });
              }
            }
          }
        } catch {
          /* ignore per-account errors */
        }
      })
    );
  }

  // Sort: ACTIVE first, then by name
  matchingAds.sort((a, b) => {
    if (a.effectiveStatus === 'ACTIVE' && b.effectiveStatus !== 'ACTIVE') return -1;
    if (b.effectiveStatus === 'ACTIVE' && a.effectiveStatus !== 'ACTIVE') return 1;
    return a.name.localeCompare(b.name);
  });

  console.log(`[findMessagingAdsForPage] Found ${matchingAds.length} ads for page ${pageId}`);
  mktPageAdsCache[cacheKey] = { ads: matchingAds, ts: Date.now() };
  return matchingAds;
}

/**
 * Quick fetch of ads_posts for a page (posts currently used as ads).
 * Uses page access token. Returns ad post content for UI display.
 */
export async function getPageAdsPosts(
  pageAccessToken: string,
  pageId: string
): Promise<
  Array<{
    id: string;
    message: string | null;
    fullPicture: string | null;
    createdTime: string | null;
  }>
> {
  try {
    const url = `https://graph.facebook.com/v22.0/${pageId}/ads_posts?fields=id,message,full_picture,created_time&limit=10&access_token=${pageAccessToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.warn('[getPageAdsPosts]', data.error.message);
      return [];
    }
    return (data.data || []).map(
      (p: { id: string; message?: string; full_picture?: string; created_time?: string }) => ({
        id: p.id,
        message: p.message || null,
        fullPicture: p.full_picture || null,
        createdTime: p.created_time || null,
      })
    );
  } catch (e) {
    console.warn('[getPageAdsPosts] Error:', e);
    return [];
  }
}
