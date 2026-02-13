/**
 * GET /api/adbox/conversation/[conversationId]/ad-preview?pageId=xxx
 *
 * ดึง ad_id เฉพาะที่ได้จาก Facebook (ไม่เดาจากโฆษณาในเพจ)
 * Detection: 1) DB จาก webhook/sync  2) conversation link  3) labels  4) message shares/attachments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdboxAccessToken } from '@/app/actions/adbox';
import { getPageAccessToken } from '@/lib/facebook-adbox';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Extract ad_id from a URL string
function extractAdIdFromUrl(url: string): string | null {
  const match = url.match(/ad_id=(\d+)/);
  return match ? match[1] : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const pageId = req.nextUrl.searchParams.get('pageId');
  if (!conversationId || !pageId) {
    return NextResponse.json({ error: 'Missing conversationId or pageId' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userToken = await getAdboxAccessToken();
    if (!userToken) {
      return NextResponse.json({ adId: null, ad: null });
    }

    const pageToken = await getPageAccessToken(userToken, pageId);
    let adId: string | null = null;

    // ──── Step 1: Check DB for adId from previous sync/webhook ────
    try {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { adId: true },
      });
      if (conv?.adId) adId = conv.adId;
    } catch { /* ignore */ }

    // ──── Step 2: Check conversation link (works on both Conversation and UnifiedThread) ────
    if (!adId) {
      try {
        const convUrl = `https://graph.facebook.com/v22.0/${conversationId}?fields=link&access_token=${pageToken}`;
        const convRes = await fetch(convUrl);
        const convData = await convRes.json();
        if (!convData.error && typeof convData.link === 'string') {
          adId = extractAdIdFromUrl(convData.link);
        }
      } catch { /* ignore */ }
    }

    // ──── Step 3: Try conversation labels (only works on older Conversation type) ────
    if (!adId) {
      try {
        const labelsUrl = `https://graph.facebook.com/v22.0/${conversationId}?fields=labels&access_token=${pageToken}`;
        const labelsRes = await fetch(labelsUrl);
        const labelsData = await labelsRes.json();
        if (!labelsData.error && labelsData.labels?.data?.length) {
          const adLabel = labelsData.labels.data.find((l: { name?: string }) => l.name?.startsWith('ad_id.'));
          if (adLabel?.name) {
            const parts = adLabel.name.split('.');
            adId = parts.length > 1 ? parts[1] : null;
          }
        }
      } catch { /* ignore - may fail on UnifiedThread */ }
    }

    // ──── Step 4: Check messages for ad-related shares/attachments ────
    if (!adId) {
      try {
        const msgsUrl = `https://graph.facebook.com/v22.0/${conversationId}/messages?fields=message,shares,attachments{type,name,description,url,title},created_time&limit=10&access_token=${pageToken}`;
        const msgsRes = await fetch(msgsUrl);
        const msgsData = await msgsRes.json();

        if (!msgsData.error && Array.isArray(msgsData.data)) {
          for (const msg of msgsData.data) {
            if (msg.shares?.data) {
              for (const share of msg.shares.data) {
                const shareLink = share.link || share.url || '';
                if (shareLink) {
                  const id = extractAdIdFromUrl(shareLink);
                  if (id) { adId = id; break; }
                }
              }
              if (adId) break;
            }
            if (msg.attachments?.data) {
              for (const att of msg.attachments.data) {
                if (att.url) {
                  const id = extractAdIdFromUrl(att.url);
                  if (id) { adId = id; break; }
                }
              }
              if (adId) break;
            }
          }
        }
      } catch { /* ignore */ }
    }

    if (!adId) {
      return NextResponse.json({ adId: null, ad: null });
    }

    // ──── Fetch ad creative details for an actual ad_id ────
    const fields = encodeURIComponent(
      'name,creative{thumbnail_url,title,body,name,image_url,object_story_spec},adcreatives{thumbnail_url,title,body,name,image_url}'
    );
    const adUrl = `https://graph.facebook.com/v22.0/${adId}?fields=${fields}&access_token=${userToken}`;
    const adRes = await fetch(adUrl);
    const adData = await adRes.json();

    if (adData.error) {
      console.warn('[ad-preview] Ad fetch error:', adData.error.message);
      return NextResponse.json({
        adId,
        ad: { id: adId, name: null, thumbnailUrl: null, title: null, body: null },
      });
    }

    const cr = adData.creative;
    const ar = adData.adcreatives;
    const fromCreative = typeof cr === 'object' && cr !== null && !Array.isArray(cr) ? cr : null;
    const fromAr = Array.isArray(ar?.data) && ar.data[0] ? ar.data[0] : null;
    const creative = fromCreative || fromAr;

    const ad = {
      id: adId,
      name: adData.name || null,
      thumbnailUrl: creative?.thumbnail_url || creative?.image_url || null,
      title: creative?.title || null,
      body: creative?.body || null,
      creativeName: creative?.name || null,
    };

    // Save adId to DB for future reference
    try {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { adId, adName: adData.name || null },
      });
    } catch { /* conversation might not exist in DB yet */ }

    return NextResponse.json({ adId, ad });
  } catch (error) {
    console.error('[adbox ad-preview]', error);
    return NextResponse.json({ adId: null, ad: null });
  }
}
