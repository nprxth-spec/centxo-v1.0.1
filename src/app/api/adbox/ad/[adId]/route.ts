/**
 * GET /api/adbox/ad/[adId]
 *
 * Fetches ad details (name, creative thumbnail, title, body) from Meta Marketing API.
 * Used to show which ad post the customer messaged from in Adbox chat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdboxAccessToken } from '@/app/actions/adbox';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params;
  if (!adId) {
    return NextResponse.json({ error: 'Missing adId' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await getAdboxAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        error: 'No ads token',
        ad: { id: adId, name: null, thumbnailUrl: null, title: null, body: null },
      });
    }

    // Meta Marketing API: Ad with creative (thumbnail, title, body) - try creative first, fallback adcreatives
    const fields = encodeURIComponent(
      'name,creative{thumbnail_url,title,body,name},adcreatives{thumbnail_url,title,body,name}'
    );
    const url = `https://graph.facebook.com/v22.0/${adId}?fields=${fields}&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({
        error: data.error.message || 'Ad fetch failed',
        ad: { id: adId, name: null, thumbnailUrl: null, title: null, body: null },
      });
    }

    const cr = data.creative;
    const ar = data.adcreatives;
    const fromCreative = typeof cr === 'object' && cr !== null && !Array.isArray(cr) ? cr : null;
    const fromAdcreatives = Array.isArray(ar?.data) && ar.data[0] ? ar.data[0] : null;
    const creative = fromCreative || fromAdcreatives;
    const ad = {
      id: adId,
      name: data.name || null,
      thumbnailUrl: creative?.thumbnail_url || null,
      title: creative?.title || null,
      body: creative?.body || null,
      creativeName: creative?.name || null,
    };

    return NextResponse.json({ ad });
  } catch (error) {
    console.error('[adbox ad]', error);
    return NextResponse.json(
      { error: 'internal_error', ad: { id: adId, name: null, thumbnailUrl: null, title: null, body: null } },
      { status: 500 }
    );
  }
}
