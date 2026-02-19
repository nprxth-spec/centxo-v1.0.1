/**
 * GET /api/adbox/messages/live?conversationId=XXX&pageId=YYY
 *
 * Real-time message sync: pulls from Facebook API → DB → returns.
 * Use when conversation is open for near-instant message delivery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncMessagesOnce } from '@/app/actions/inbox';
import { inboxDb } from '@/lib/inbox-db';

export const dynamic = 'force-dynamic';

const SYNC_COOLDOWN_MS = 2000;
const lastSyncAt: Record<string, number> = {};

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId');
  const pageId = req.nextUrl.searchParams.get('pageId');

  if (!conversationId || !pageId) {
    return NextResponse.json({ error: 'Missing conversationId or pageId' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cacheKey = `${conversationId}`;
    const now = Date.now();
    const last = lastSyncAt[cacheKey] || 0;

    if (now - last >= SYNC_COOLDOWN_MS) {
      lastSyncAt[cacheKey] = now;
      try {
        await syncMessagesOnce(conversationId, pageId);
      } catch (e) {
        const err = e as Error;
        if (!err.message?.includes('Unsupported get request') && !err.message?.includes('invalid')) {
          console.warn('[inbox live] Sync error:', err.message);
        }
      }
    }

    const conv = await inboxDb.findConversationById(conversationId);
    if (!conv) {
      return NextResponse.json({ messages: [], synced: false });
    }

    const raw = await inboxDb.findMessagesByConversation(conversationId, 500);
    const messages = raw.map((m) => ({
      id: m.id,
      message: m.content,
      attachments: m.attachments,
      stickerUrl: m.stickerUrl,
      created_time: m.createdAt?.toISOString?.() || m.createdAt,
      from: { id: m.senderId, name: m.senderName },
    }));

    return NextResponse.json({ messages, synced: true });
  } catch (error) {
    console.error('[adbox live]', error);
    return NextResponse.json({ messages: [], synced: false, error: 'internal_error' }, { status: 500 });
  }
}
