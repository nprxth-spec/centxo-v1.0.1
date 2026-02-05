'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adboxDb } from '@/lib/adbox-db';
import { getPages, getPageConversations, getConversationMessages, sendMessage } from '@/lib/facebook-adbox';
import { decryptToken } from '@/lib/services/metaClient';

async function getAdboxAccessToken(): Promise<string | null> {
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

export async function fetchPages() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const accessToken = await getAdboxAccessToken();
  if (!accessToken) {
    throw new Error('No Facebook token found. Please connect Facebook in Settings > Connections.');
  }

  try {
    const pages = await getPages(accessToken);
    return JSON.parse(JSON.stringify(pages));
  } catch (error: unknown) {
    console.error('Failed to fetch pages:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch pages');
  }
}

export async function fetchConversationsFromDB(pageIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const accessToken = await getAdboxAccessToken();
  if (!accessToken || pageIds.length === 0) return [];

  try {
    const conversations = await adboxDb.findConversationsWithMessages(pageIds, 100);
    return conversations.map((c) => {
      let participantName = c.participantName || 'Facebook User';
      let participantId = c.participantId;

      if (!c.participantId && c.messages.length > 0) {
        const msg = c.messages[0];
        if (!msg.isFromPage && msg.senderName) {
          participantName = msg.senderName;
          participantId = msg.senderId;
        }
      }

      return {
        id: c.id,
        pageId: c.pageId,
        updated_time: c.lastMessageAt.toISOString(),
        snippet: c.snippet,
        unread_count: c.unreadCount,
        adId: c.adId || null,
        facebookLink: c.facebookLink || null,
        participants: { data: [{ name: participantName, id: participantId }] },
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

  const accessToken = await getAdboxAccessToken();
  if (!accessToken) return [];

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
  conversationId: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const accessToken = await getAdboxAccessToken();
  if (!accessToken) throw new Error('No Facebook token found');

  try {
    const result = await sendMessage(accessToken, pageId, recipientId, messageText);

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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send',
    };
  }
}

export async function syncConversationsOnce(pages: { id: string; access_token?: string }[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const accessToken = await getAdboxAccessToken();
  if (!accessToken) throw new Error('No Facebook token found');

  try {
    const allConversations: Array<Record<string, unknown>> = [];

    for (const page of pages) {
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
          } | undefined;

          let unreadCount = (conv.unread_count as number) || 0;
          const lastMessageTime = new Date(conv.updated_time as string);

          if (existing?.lastReadAt) {
            const lastReadTime = new Date(existing.lastReadAt);
            if (lastReadTime.getTime() >= lastMessageTime.getTime() - 5000) {
              unreadCount = 0;
            }
          }

          await adboxDb.upsertConversation(
            conv.id as string,
            {
              pageId: page.id,
              lastMessageAt: lastMessageTime,
              snippet: (conv.snippet as string) || '',
              unreadCount: (conv.unread_count as number) || 0,
              participantId,
              participantName,
              adId: (conv.ad_id as string) || null,
            },
            {
              lastMessageAt: lastMessageTime,
              snippet: (conv.snippet as string) || '',
              unreadCount,
              participantId,
              participantName,
              ...((conv.ad_id as string) && { adId: conv.ad_id as string }),
            }
          );

          allConversations.push({
            ...conv,
            pageId: page.id,
            adId: conv.ad_id || null,
            unread_count: unreadCount,
            participants: {
              data: [{ name: participantName, id: participantId }],
            },
          });
        }
      } catch (e) {
        console.error(`Failed to sync for page ${page.id}`, e);
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
  if (!accessToken) throw new Error('No Facebook token found');

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
        const attachments = atts.data.map((att: Record<string, unknown>) => ({
          type: att.type || 'file',
          url: (att as { image_data?: { url?: string }; file_url?: string }).image_data?.url ||
            (att as { file_url?: string }).file_url ||
            null,
        }));
        attachmentsJson = JSON.stringify(attachments);
        const sticker = attachments.find((a) => (a as { type?: string }).type === 'sticker');
        if (sticker) stickerUrl = (sticker as { url?: string }).url || null;
        if (!messageContent) messageContent = '[Sticker]';
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
