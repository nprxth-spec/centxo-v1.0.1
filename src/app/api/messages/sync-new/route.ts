import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { inboxDb } from '@/lib/inbox-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const pageIds = searchParams.get('pageIds')?.split(',').filter(Boolean) || [];
  const since = searchParams.get('since');

  if (pageIds.length === 0) {
    return NextResponse.json({ newMessages: [], synced: false });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ newMessages: [], synced: false, reason: 'not_authenticated' });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000);

    const newMessages = await inboxDb.findNewMessagesForPages(pageIds, sinceDate);
    const updatedConversations = await inboxDb.findUpdatedConversations(pageIds, sinceDate);

    return NextResponse.json({
      newMessages: newMessages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.senderName,
        content: m.content,
        createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
        pageId: m.conversation?.pageId || (m as { pageId?: string }).pageId,
      })),
      updatedConversations: updatedConversations.map((c) => ({
        id: c.id,
        pageId: c.pageId,
        snippet: c.snippet,
        unread_count: c.unreadCount,
        updated_time: c.lastMessageAt instanceof Date ? c.lastMessageAt.toISOString() : (c.lastMessageAt as string),
        adId: c.adId || null,
        facebookLink: c.facebookLink || null,
        participants: {
          data: [{ id: c.participantId, name: c.participantName }],
        },
      })),
      synced: true,
      source: 'database',
    });
  } catch (error) {
    console.error('[sync-new] Error:', error);
    return NextResponse.json({ newMessages: [], synced: false, error: 'internal_error' });
  }
}
