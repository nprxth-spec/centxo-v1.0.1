import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdboxAccessToken, fetchPages } from '@/app/actions/adbox';
const PICTURE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hr - reduce gr:get:User/picture

declare global {
  var _adboxPictureCache: Record<string, { buffer: ArrayBuffer; contentType: string; timestamp: number }> | undefined;
}

const pictureCache = globalThis._adboxPictureCache ?? {};
if (typeof globalThis !== 'undefined') globalThis._adboxPictureCache = pictureCache;

/**
 * GET /api/adbox/participant-picture?participantId=XXX&pageId=YYY
 * Returns the Messenger participant's profile picture.
 * Caches getPages (me/accounts) and picture to reduce Facebook API quota.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const participantId = req.nextUrl.searchParams.get('participantId');
    const pageId = req.nextUrl.searchParams.get('pageId');
    if (!participantId) {
      return NextResponse.json({ error: 'Missing participantId' }, { status: 400 });
    }

    const picCacheKey = `pic_${participantId}_${pageId || 'none'}`;
    const cachedPic = pictureCache[picCacheKey];
    if (cachedPic && Date.now() - cachedPic.timestamp < PICTURE_CACHE_TTL) {
      return new NextResponse(cachedPic.buffer, {
        headers: {
          'Content-Type': cachedPic.contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const userToken = await getAdboxAccessToken();
    if (!userToken) {
      return NextResponse.json({ error: 'No token' }, { status: 403 });
    }

    let pageToken = userToken;
    if (pageId) {
      const pages = await fetchPages();
      const page = pages.find((p: { id: string }) => p.id === pageId);
      if (page?.access_token) pageToken = page.access_token;
    }

    const apiUrl = `https://graph.facebook.com/v22.0/${participantId}/picture?type=normal&redirect=false&access_token=${pageToken}`;
    const apiRes = await fetch(apiUrl, { headers: { 'User-Agent': 'Centxo/1.0' } });
    const apiData = await apiRes.json();

    if (apiData.error) {
      return NextResponse.json({ error: apiData.error.message || 'Picture not found' }, { status: 404 });
    }

    const data = apiData.data as { url?: string } | undefined;
    const imageUrl = data?.url;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Picture not available' }, { status: 404 });
    }

    const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Centxo/1.0' } });
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Picture not found' }, { status: 404 });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    pictureCache[picCacheKey] = { buffer, contentType, timestamp: Date.now() };

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[adbox participant-picture]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
