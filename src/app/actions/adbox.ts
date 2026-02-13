'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adboxDb } from '@/lib/adbox-db';
import { getPages, getPageConversations, getConversationMessages, sendMessage } from '@/lib/facebook-adbox';
import { decryptToken } from '@/lib/services/metaClient';

export async function getAdboxAccessToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  // 1. User.facebookPageToken + related token sources
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      metaAccount: { select: { accessToken: true } },
      accounts: { where: { provider: 'facebook' }, select: { access_token: true } },
      teamMembers: { where: { accessToken: { not: null } }, select: { accessToken: true } },
    },
  });

  if (!user) return null;

  const u = user as {
    facebookPageToken?: string | null;
    metaAccount?: { accessToken: string } | null;
    accounts?: { access_token: string | null }[];
    teamMembers?: { accessToken: string | null }[];
  };

  if (u.facebookPageToken) return u.facebookPageToken;

  // 2. MetaAccount.accessToken (decrypted - from Settings > Meta Connect)
  if (u.metaAccount?.accessToken) {
    try {
      const decrypted = decryptToken(u.metaAccount.accessToken);
      if (decrypted && decrypted.length > 10) return decrypted;
    } catch {
      // Encrypted token failed to decrypt, skip
    }
  }

  // 3. Account table (NextAuth - when user signed in with Facebook OAuth)
  const fbAccount = u.accounts?.[0];
  if (fbAccount?.access_token) return fbAccount.access_token;

  // 4. Session accessToken
  const sessionToken = (session as { accessToken?: string }).accessToken;
  if (sessionToken) return sessionToken;

  // 5. TeamMember accessToken
  const memberToken = u.teamMembers?.[0]?.accessToken;
  if (memberToken) return memberToken;

  return null;
}

const PAGES_CACHE_TTL = 60 * 60 * 1000; // 60 min - reduce gr:get:User/accounts
declare global {
  var _adboxPagesCache: Record<string, { data: unknown[]; timestamp: number }> | undefined;
}
const pagesCache = globalThis._adboxPagesCache ?? {};
if (typeof globalThis !== 'undefined') globalThis._adboxPagesCache = pagesCache;

export async function fetchPages() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Not authenticated');

  const cacheKey = `fp_${session.user.id}`;
  const cached = pagesCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < PAGES_CACHE_TTL) {
    return JSON.parse(JSON.stringify(cached.data));
  }

  const accessToken = await getAdboxAccessToken();
  if (!accessToken) {
    throw new Error('No Facebook token found. Please connect Facebook in Account > Team.');
  }

  try {
    const pages = await getPages(accessToken);
    pagesCache[cacheKey] = { data: pages, timestamp: Date.now() };
    return JSON.parse(JSON.stringify(pages));
  } catch (error: unknown) {
    console.error('Failed to fetch pages:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch pages');
  }
}

export async function fetchConversationsFromDB(pageIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  if (pageIds.length === 0) return [];

  try {
    const conversations = await adboxDb.findConversationsWithMessages(pageIds, 100);
    const byKey = new Map<string, { c: typeof conversations[0]; lastMessageAt: Date; adId: string | null; facebookLink: string | null }>();
    for (const c of conversations) {
      const pid = c.participantId || (c.messages[0] as { senderId?: string } | undefined)?.senderId || '';
      const key = `${c.pageId}:${pid}`;
      const lastAt = c.lastMessageAt instanceof Date ? c.lastMessageAt : new Date(c.lastMessageAt);
      const existing = byKey.get(key);
      if (!existing || lastAt.getTime() > existing.lastMessageAt.getTime()) {
        byKey.set(key, {
          c,
          lastMessageAt: lastAt,
          adId: c.adId || existing?.adId || null,
          facebookLink: c.facebookLink || existing?.facebookLink || null,
        });
      } else {
        if (c.adId) existing.adId = c.adId;
        if (c.facebookLink) existing.facebookLink = c.facebookLink;
      }
    }
    return Array.from(byKey.values()).map(({ c, adId: mergedAdId, facebookLink: mergedLink }) => {
      let participantName = c.participantName || 'Facebook User';
      let participantId = c.participantId;

      // Try to get participantId from messages if not in conversation record
      if (!participantId && c.messages.length > 0) {
        // Find the first message that's not from the page
        const userMessage = c.messages.find((msg: { isFromPage?: boolean }) => !msg.isFromPage);
        if (userMessage) {
          const msg = userMessage as { senderId?: string; senderName?: string };
          if (msg.senderId) {
            participantId = msg.senderId;
            if (msg.senderName) {
              participantName = msg.senderName;
            }
          }
        }

        // Final fallback: use first message senderId if still no participantId
        if (!participantId) {
          const msg = c.messages[0] as { senderId?: string };
          if (msg.senderId) {
            participantId = msg.senderId;
          }
        }
      }

      // Debug logging for missing participantId
      if (!participantId) {
        console.warn('[fetchConversationsFromDB] Missing participantId for conversation:', {
          conversationId: c.id,
          pageId: c.pageId,
          participantName,
          messageCount: c.messages.length,
          messages: c.messages.map((m: { senderId?: string; isFromPage?: boolean }) => ({
            senderId: m.senderId,
            isFromPage: m.isFromPage,
          })),
        });
      }

      return {
        id: c.id,
        pageId: c.pageId,
        updated_time: c.lastMessageAt.toISOString(),
        snippet: c.snippet,
        unread_count: c.unreadCount,
        adId: mergedAdId || c.adId || null,
        facebookLink: mergedLink || c.facebookLink || null,
        participants: { data: [{ name: participantName, id: participantId || undefined }] },
      };
    });
  } catch (error) {
    console.error('Error fetching conversations from DB:', error);
    return [];
  }
}

export async function fetchMessagesFromDB(conversationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  try {
    const conversation = await adboxDb.findConversationById(conversationId);
    if (!conversation) return [];

    const messages = await adboxDb.findMessagesByConversation(conversationId, 500);
    return messages.map((m) => ({
      id: m.id,
      message: m.content,
      attachments: m.attachments,
      stickerUrl: m.stickerUrl,
      created_time: m.createdAt?.toISOString?.() || m.createdAt,
      from: { id: m.senderId, name: m.senderName },
    }));
  } catch (error) {
    console.error('Error fetching messages from DB:', error);
    return [];
  }
}

export async function sendReply(
  pageId: string,
  recipientId: string,
  messageText: string,
  conversationId: string,
  pageAccessToken?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const accessToken = await getAdboxAccessToken();
  // if (!accessToken) throw new Error('No Facebook token found');

  if (!accessToken && !pageAccessToken) {
    throw new Error('No Facebook token found');
  }

  try {
    // ตรวจสอบว่าเวลาผ่านไป 24 ชั่วโมงหรือยัง
    const conversation = await adboxDb.findConversationById(conversationId);
    const now = new Date();
    const lastMessageAt = conversation?.lastMessageAt
      ? (conversation.lastMessageAt instanceof Date
        ? conversation.lastMessageAt
        : new Date(conversation.lastMessageAt))
      : null;

    const hoursSinceLastMessage = lastMessageAt
      ? (now.getTime() - lastMessageAt.getTime()) / (1000 * 60 * 60)
      : 0;

    const isWithin24Hours = hoursSinceLastMessage < 24;
    const isWithin7Days = hoursSinceLastMessage < 7 * 24;

    // ถ้าผ่าน 24 ชั่วโมงแล้ว แต่ยังไม่เกิน 7 วัน → ใช้ HUMAN_AGENT tag
    // ถ้าเกิน 7 วันแล้ว → ส่งไม่ได้ (จะ error จาก Facebook)
    let messagingOptions: { messagingType?: 'RESPONSE' | 'MESSAGE_TAG'; tag?: 'HUMAN_AGENT' } | undefined;

    if (!isWithin24Hours && isWithin7Days) {
      messagingOptions = {
        messagingType: 'MESSAGE_TAG',
        tag: 'HUMAN_AGENT',
      };
    }

    const result = await sendMessage(accessToken, pageId, recipientId, messageText, {
      ...messagingOptions,
      pageAccessToken: pageAccessToken
    });

    try {
      await adboxDb.createMessage({
        id: (result as { message_id?: string }).message_id || `temp-${Date.now()}`,
        conversationId,
        senderId: pageId,
        senderName: 'Me',
        content: messageText,
        createdAt: new Date(),
        isFromPage: true,
      });
      await adboxDb.updateConversation(conversationId, {
        lastMessageAt: new Date(),
        snippet: messageText,
      });
    } catch (dbError) {
      console.error('Failed to save reply to DB:', dbError);
    }

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('Failed to send message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send';

    // ถ้า error เกี่ยวกับ 24-hour window หรือ tag → แสดงข้อความที่เข้าใจง่าย
    if (errorMessage.includes('24') || errorMessage.includes('messaging_eligibility') || errorMessage.includes('tag')) {
      return {
        success: false,
        error: 'ไม่สามารถส่งข้อความได้: เวลาผ่านไปเกิน 24 ชั่วโมงแล้ว (หรือเกิน 7 วันสำหรับ HUMAN_AGENT tag)',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

const SYNC_PAGES_CONCURRENCY = 5;

async function syncOnePageConversations(
  accessToken: string | null,
  page: { id: string; access_token?: string }
): Promise<Array<Record<string, unknown>>> {
  const pageConversations: Array<Record<string, unknown>> = [];
  try {
    const convs = await getPageConversations(accessToken, page.id, page.access_token);
    const existingConvs = await adboxDb.findConversationsByPageIds([page.id]);
    const existingMap = new Map(existingConvs.map((c) => [c.id, c]));

    for (const conv of convs as Array<Record<string, unknown>>) {
      const participants = conv.participants as { data?: Array<{ id?: string; name?: string }> } | undefined;
      const otherUser = participants?.data?.find((p: { id?: string }) => p.id !== page.id);
      const participantId = otherUser?.id || (conv.id as string);
      const participantName = otherUser?.name || 'Facebook User';

      const existing = existingMap.get(conv.id as string) as {
        lastReadAt?: Date | null;
        unreadCount?: number;
        snippet?: string | null;
        participantName?: string | null;
        adId?: string | null;
      } | undefined;

      let unreadCount = (conv.unread_count as number) || 0;
      const lastMessageTime = new Date(conv.updated_time as string);

      if (existing?.lastReadAt) {
        const lastReadTime = new Date(existing.lastReadAt);
        if (lastReadTime.getTime() >= lastMessageTime.getTime() - 5000) {
          unreadCount = 0;
        }
      }

      // Preserve existing adId from DB if conversation API didn't return one
      const convAdId = (conv.ad_id as string) || existing?.adId || null;

      await adboxDb.upsertConversation(
        conv.id as string,
        {
          pageId: page.id,
          lastMessageAt: lastMessageTime,
          snippet: (conv.snippet as string) || '',
          unreadCount: (conv.unread_count as number) || 0,
          participantId,
          participantName,
          adId: convAdId,
        },
        {
          lastMessageAt: lastMessageTime,
          snippet: (conv.snippet as string) || '',
          unreadCount,
          participantId,
          participantName,
          ...(convAdId && { adId: convAdId }),
        }
      );

      pageConversations.push({
        ...conv,
        pageId: page.id,
        adId: convAdId,
        unread_count: unreadCount,
        participants: {
          data: [{ name: participantName, id: participantId }],
        },
      });
    }

    // ไม่เดา ad_id ให้ทุกแชท – ใช้เฉพาะที่ได้จาก Facebook (webhook / conversation API) เท่านั้น
  } catch (e) {
    console.error(`Failed to sync for page ${page.id}`, e);
  }
  return pageConversations;
}

export async function syncConversationsOnce(pages: { id: string; access_token?: string }[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const accessToken = await getAdboxAccessToken();
  // if (!accessToken) throw new Error('No Facebook token found');

  try {
    const allConversations: Array<Record<string, unknown>> = [];
    const concurrency = SYNC_PAGES_CONCURRENCY;

    for (let i = 0; i < pages.length; i += concurrency) {
      const chunk = pages.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map((page) => syncOnePageConversations(accessToken, page))
      );
      for (const list of chunkResults) {
        allConversations.push(...list);
      }
    }

    const sorted = allConversations.sort(
      (a, b) =>
        new Date(b.updated_time as string).getTime() - new Date(a.updated_time as string).getTime()
    );
    return JSON.parse(JSON.stringify(sorted));
  } catch (error) {
    console.error('Failed to sync conversations:', error);
    return [];
  }
}

export async function syncMessagesOnce(
  conversationId: string,
  pageId: string,
  pageAccessToken?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const accessToken = await getAdboxAccessToken();
  // if (!accessToken) throw new Error('No Facebook token found');

  try {
    const messages = await getConversationMessages(
      accessToken,
      conversationId,
      pageId,
      pageAccessToken
    );

    for (const msg of messages as Array<Record<string, unknown>>) {
      let attachmentsJson: string | null = null;
      let stickerUrl: string | null = null;
      let messageContent = (msg.message as string) || null;

      const atts = msg.attachments as { data?: Array<Record<string, unknown>> } | undefined;
      if (atts?.data?.length) {
        const attachments = atts.data.map((att: Record<string, unknown>) => {
          const attAny = att as {
            type?: string;
            image_data?: { url?: string };
            file_url?: string;
            payload?: { url?: string };
          };
          let typeStr = typeof attAny.type === 'string' ? attAny.type.toLowerCase() : 'file';
          const url =
            attAny.image_data?.url ||
            attAny.file_url ||
            attAny.payload?.url ||
            null;
          if (attAny.image_data?.url || (['image', 'photo'].includes(typeStr) && url))
            typeStr = 'image';
          return { type: typeStr, url };
        });
        attachmentsJson = JSON.stringify(attachments);
        const sticker = attachments.find((a) => a.type === 'sticker');
        const image = attachments.find((a) => (a.type === 'image' || a.type === 'photo') && a.url);
        if (sticker) stickerUrl = sticker.url || null;
        if (!messageContent) {
          if (sticker) messageContent = '[Sticker]';
          else if (image?.url) messageContent = '[Image]';
          else messageContent = '[Attachment]';
        }
      }

      if (msg.sticker) {
        stickerUrl = msg.sticker as string;
        if (!messageContent) messageContent = '[Sticker]';
        if (!attachmentsJson) attachmentsJson = JSON.stringify([{ type: 'sticker', url: msg.sticker }]);
      }

      await adboxDb.upsertMessage(
        msg.id as string,
        {
          conversationId,
          senderId: (msg.from as { id?: string })?.id || 'unknown',
          senderName: (msg.from as { name?: string })?.name || 'Unknown',
          content: messageContent,
          attachments: attachmentsJson,
          stickerUrl,
          createdAt: new Date(msg.created_time as string),
          isFromPage: (msg.from as { id?: string })?.id === pageId,
        },
        {
          content: messageContent,
          attachments: attachmentsJson,
          stickerUrl,
          isFromPage: (msg.from as { id?: string })?.id === pageId,
        }
      );
    }

    return { success: true, count: messages.length };
  } catch (error) {
    console.error('Failed to sync messages:', error);
    return { success: false, count: 0 };
  }
}

export async function markConversationAsRead(conversationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  try {
    await adboxDb.updateConversation(conversationId, {
      unreadCount: 0,
      lastReadAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    return { success: false };
  }
}

export async function updateConversationViewer(conversationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  try {
    await adboxDb.updateConversation(conversationId, {
      viewedBy: session.user.id,
      viewedByName: session.user.name || 'Unknown',
      viewedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating conversation viewer:', error);
    return { success: false };
  }
}

export async function fetchAdDetails(_adId: string) {
  return null;
}

export async function markConversationAsUnread(conversationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  try {
    await adboxDb.updateConversation(conversationId, {
      unreadCount: 1,
      lastReadAt: new Date(0),
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to mark as unread:', error);
    return { success: false };
  }
}

export async function updateConversationNotes(conversationId: string, notes: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  try {
    await adboxDb.updateConversation(conversationId, { notes });
    return { success: true };
  } catch (error) {
    console.error('Failed to update notes:', error);
    return { success: false };
  }
}

export async function addConversationLabel(conversationId: string, label: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  try {
    const conv = await adboxDb.findConversationById(conversationId);
    let labels: string[] = [];
    if (conv?.labels) {
      try {
        labels = JSON.parse(conv.labels);
      } catch { }
    }
    if (!labels.includes(label)) {
      labels.push(label);
      await adboxDb.updateConversation(conversationId, { labels: JSON.stringify(labels) });
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to add label:', error);
    return { success: false };
  }
}

export async function removeConversationLabel(conversationId: string, label: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  try {
    const conv = await adboxDb.findConversationById(conversationId);
    let labels: string[] = [];
    if (conv?.labels) {
      try {
        labels = JSON.parse(conv.labels);
      } catch { }
    }
    if (labels.includes(label)) {
      labels = labels.filter((l) => l !== label);
      await adboxDb.updateConversation(conversationId, { labels: JSON.stringify(labels) });
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to remove label:', error);
    return { success: false };
  }
}
