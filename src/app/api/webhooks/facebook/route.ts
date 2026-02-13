/**
 * Facebook Webhook - AdBox Messenger
 * GET: Verification (Facebook requires this to subscribe)
 * POST: Receive messaging events - saves to DB for instant delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { adboxDb } from '@/lib/adbox-db';

const VERIFY_TOKEN =
  process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'centxo_adbox_verify_token';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entries = body.entry || [];
    for (const entry of entries) {
      const messaging = entry.messaging || [];
      for (const event of messaging) {
        const senderId = event.sender?.id;
        const pageId = event.recipient?.id;
        if (!senderId || !pageId) continue;

        // Standalone messaging_referrals: user opens thread from ad (no message yet)
        const standaloneReferral = event.referral as { ad_id?: string; source?: string } | undefined;
        if (standaloneReferral?.source === 'ADS' && standaloneReferral?.ad_id) {
          const adId = String(standaloneReferral.ad_id);
          const conv = await adboxDb.findConversationByPageAndParticipant(pageId, senderId);
          const convId = conv?.id || `t_${pageId}_${senderId}`;
          const now = new Date(event.timestamp || Date.now());
          if (!conv) {
            await adboxDb.upsertConversation(
              convId,
              {
                pageId,
                participantId: senderId,
                participantName: 'Facebook User',
                lastMessageAt: now,
                snippet: '',
                unreadCount: 0,
                adId,
              },
              { lastMessageAt: now, adId }
            );
          } else {
            await adboxDb.updateConversation(convId, { adId });
          }
          continue;
        }

        if (!event.message || event.message.is_echo) continue;

        // Ad referral in message: when user sends first message from Click-to-Messenger ad
        const referral = event.message.referral as { ad_id?: string; source?: string } | undefined;
        const adId = referral?.source === 'ADS' && referral?.ad_id ? String(referral.ad_id) : null;

        const mid = event.message.mid;
        const text = event.message.text || null;
        const atts = event.message.attachments;
        let content = text;
        let attachmentsJson: string | null = null;
        let stickerUrl: string | null = null;

        if (atts?.length && !content) {
          const arr = atts.map((a: { type?: string; payload?: { url?: string } }) => ({
            type: (a.type || 'file').toLowerCase(),
            url: a.payload?.url || null,
          }));
          attachmentsJson = JSON.stringify(arr);
          const sticker = arr.find((a: { type: string }) => a.type === 'sticker');
          const image = arr.find((a: { type: string }) => a.type === 'image');
          if (sticker?.url) stickerUrl = sticker.url;
          content = sticker ? '[Sticker]' : image ? '[Image]' : '[Attachment]';
        }

        let conv = await adboxDb.findConversationByPageAndParticipant(pageId, senderId);
        const convId = conv?.id || `t_${pageId}_${senderId}`;
        const now = new Date(event.timestamp || Date.now());
        const snippet = (content || '').slice(0, 200);
        if (!conv) {
          await adboxDb.upsertConversation(
            convId,
            {
              pageId,
              participantId: senderId,
              participantName: 'Facebook User',
              lastMessageAt: now,
              snippet,
              unreadCount: 1,
              ...(adId && { adId }),
            },
            {
              lastMessageAt: now,
              snippet,
              unreadCount: 1,
              ...(adId && { adId }),
            }
          );
        } else {
          const updateData: Record<string, unknown> = {
            lastMessageAt: now,
            snippet,
            unreadCount: (conv.unreadCount || 0) + 1,
          };
          if (adId) updateData.adId = adId;
          await adboxDb.updateConversation(convId, updateData);
        }

        if (mid) {
          try {
            await adboxDb.upsertMessage(
              mid,
              {
                conversationId: convId,
                senderId,
                senderName: 'Facebook User',
                content: content || '[Message]',
                attachments: attachmentsJson,
                stickerUrl,
                createdAt: new Date(event.timestamp || Date.now()),
                isFromPage: false,
              },
              {}
            );
          } catch (e) {
            console.warn('[webhook] Message upsert skip:', (e as Error).message);
          }
        }
      }
    }
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[webhook facebook]', error);
    return new NextResponse('Error', { status: 500 });
  }
}
