/**
 * Facebook Graph API for AdBox (Messenger Inbox)
 */

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
  userAccessToken: string,
  pageId: string,
  pageAccessToken?: string
) {
  let token = pageAccessToken;
  if (!token) {
    const pageRes = await fetch(
      `https://graph.facebook.com/v22.0/${pageId}?fields=access_token&access_token=${userAccessToken}`
    );
    const pageData = await pageRes.json();
    if (pageData.error) throw new Error(pageData.error.message);
    token = pageData.access_token;
  }

  const fetchConversations = async (includeLabels: boolean) => {
    let fields =
      'snippet,updated_time,participants{id,name,email,username,link},message_count,unread_count,link';
    if (includeLabels) fields += ',labels';

    let allConversations: Array<Record<string, unknown>> = [];
    let url: string | null = `https://graph.facebook.com/v22.0/${pageId}/conversations?fields=${fields}&platform=messenger&limit=50&access_token=${token}`;
    let pageCount = 0;
    const maxPages = 5; // up to ~250 conversations

    while (url && pageCount < maxPages) {
      const response: Response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        if (includeLabels && data.error.code === 2 && data.error.error_subcode === 2018344) {
          throw new Error('TOS_REQUIRED');
        }
        throw new Error(data.error?.message || 'Failed to fetch conversations');
      }

      const batch = (data.data || []).map((conv: Record<string, unknown>) => {
        let adId: string | null = null;
        const labels = conv.labels as { data?: Array<{ name?: string }> } | undefined;
        if (labels?.data) {
          const adLabel = labels.data.find((l) => l.name?.startsWith('ad_id.'));
          if (adLabel?.name) {
            const parts = adLabel.name.split('.');
            adId = parts.length > 1 ? parts[1] : null;
          }
        }
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
    return await fetchConversations(true);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'TOS_REQUIRED') {
      return await fetchConversations(false);
    }
    throw e;
  }
}

export async function getConversationMessages(
  userAccessToken: string,
  conversationId: string,
  pageId: string,
  pageAccessToken?: string
) {
  let token = pageAccessToken;
  if (!token) {
    const pageRes = await fetch(
      `https://graph.facebook.com/v22.0/${pageId}?fields=access_token&access_token=${userAccessToken}`
    );
    const pageData = await pageRes.json();
    if (pageData.error) throw new Error(pageData.error.message);
    token = pageData.access_token;
  }

  let allMessages: Array<Record<string, unknown>> = [];
  let url: string | null = `https://graph.facebook.com/v22.0/${conversationId}/messages?fields=message,from,created_time,attachments{type,image_data,file_url,payload},sticker&limit=20&access_token=${token}`;
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
  userAccessToken: string,
  pageId: string,
  recipientId: string,
  messageText: string
) {
  const pageRes = await fetch(
    `https://graph.facebook.com/v22.0/${pageId}?fields=access_token&access_token=${userAccessToken}`
  );
  const pageData = await pageRes.json();
  if (pageData.error) throw new Error(pageData.error.message);
  const pageAccessToken = pageData.access_token;

  const response: Response = await fetch(
    `https://graph.facebook.com/v22.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
        messaging_type: 'RESPONSE',
      }),
    }
  );

  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result;
}
