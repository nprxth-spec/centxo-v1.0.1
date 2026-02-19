/**
 * GET /api/adbox/messages?conversationId=XXX
 *
 * Lightweight: reads from DB only, no Facebook API.
 * Use for fast polling when webhook delivers to DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { inboxDb } from '@/lib/inbox-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conv = await inboxDb.findConversationById(conversationId);
    if (!conv) return NextResponse.json({ messages: [] });

    const raw = await inboxDb.findMessagesByConversation(conversationId, 500);
    const messages = raw.map((m: { id: string; content: string | null; attachments: string | null; stickerUrl: string | null; createdAt?: Date; senderId: string; senderName: string | null }) => ({
      id: m.id,
      message: m.content,
      attachments: m.attachments,
      stickerUrl: m.stickerUrl,
      created_time: m.createdAt?.toISOString?.() || m.createdAt,
      from: { id: m.senderId, name: m.senderName },
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[adbox messages]', error);
    return NextResponse.json({ messages: [], error: 'internal_error' }, { status: 500 });
  }
}
