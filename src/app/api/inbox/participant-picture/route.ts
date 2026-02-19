import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getInboxAccessToken as getAdboxAccessToken, fetchPages } from '@/app/actions/inbox';

const PICTURE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hr

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

declare global {
  var _adboxPictureCache: Record<string, { buffer: ArrayBuffer; contentType: string; timestamp: number }> | undefined;
}

const pictureCache = globalThis._adboxPictureCache ?? {};
if (typeof globalThis !== 'undefined') globalThis._adboxPictureCache = pictureCache;

export async function GET(req: NextRequest) {
  console.log('[participant-picture] GET handler called');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.warn('[participant-picture] Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const participantId = req.nextUrl.searchParams.get('participantId');
    const pageId = req.nextUrl.searchParams.get('pageId');

    console.log('[participant-picture] Request params:', { participantId, pageId });

    if (!participantId) {
      console.warn('[participant-picture] Missing participantId');
      return NextResponse.json({ error: 'Missing participantId' }, { status: 400 });
    }

    const picCacheKey = `pic_${participantId}_${pageId || 'none'}`;
    const cachedPic = pictureCache[picCacheKey];
    if (cachedPic && Date.now() - cachedPic.timestamp < PICTURE_CACHE_TTL) {
      console.log('[participant-picture] Returning cached image');
      return new NextResponse(cachedPic.buffer, {
        headers: {
          'Content-Type': cachedPic.contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const userToken = await getAdboxAccessToken();
    if (!userToken) {
      console.error('[participant-picture] No access token available');
      return NextResponse.json({ error: 'No token' }, { status: 403 });
    }

    let pageToken = userToken;
    if (pageId) {
      try {
        const pages = await fetchPages();
        const page = pages.find((p: { id: string, access_token?: string }) => p.id === pageId);
        if (page?.access_token) {
          pageToken = page.access_token;
          console.log('[participant-picture] Using page access token for page:', pageId);

          // Debug: Check token permissions
          try {
            const debugUrl = `https://graph.facebook.com/v22.0/debug_token?input_token=${pageToken}&access_token=${pageToken}`;
            const debugRes = await fetch(debugUrl);
            const debugData = await debugRes.json();
            if (debugData.data) {
              console.log('[participant-picture] Token permissions:', {
                scopes: debugData.data.scopes || [],
                type: debugData.data.type,
                app_id: debugData.data.app_id,
                expires_at: debugData.data.expires_at,
              });
            }
          } catch (debugError) {
            console.warn('[participant-picture] Could not debug token:', debugError);
          }
        } else {
          console.warn('[participant-picture] Page access token not found, using user token. Page:', pageId);
        }
      } catch (pagesError) {
        console.error('[participant-picture] Error fetching pages:', pagesError);
      }
    } else {
      console.warn('[participant-picture] No pageId provided, using user token');
    }

    // Try User Profile API first
    let imageUrl: string | undefined;
    try {
      const profileUrl = `https://graph.facebook.com/v22.0/${participantId}?fields=picture.type(normal)&access_token=${pageToken}`;
      console.log('[participant-picture] Trying User Profile API:', profileUrl.replace(pageToken, 'TOKEN_HIDDEN'));
      const profileRes = await fetch(profileUrl, { headers: { 'User-Agent': 'Centxo/1.0' } });
      const profileData = await profileRes.json();

      if (profileData.error) {
        console.warn('[participant-picture] User Profile API error:', profileData.error);
        // Error code 100, subcode 33 = missing permissions (often in Development mode)
        // Will fallback to picture endpoint, then return transparent pixel if that also fails
        if (profileData.error.code === 100 && profileData.error.error_subcode === 33) {
          console.warn('[participant-picture] User Profile API permission error (code 100, subcode 33)');
        }
      } else if (profileData.picture?.data?.url) {
        imageUrl = profileData.picture.data.url;
        console.log('[participant-picture] Got image URL from User Profile API');
      }
    } catch (profileError) {
      console.warn('[participant-picture] User Profile API exception:', profileError);
    }

    // Fallback to picture endpoint
    if (!imageUrl) {
      const apiUrl = `https://graph.facebook.com/v22.0/${participantId}/picture?type=normal&redirect=false&access_token=${pageToken}`;
      console.log('[participant-picture] Trying Picture Endpoint:', apiUrl.replace(pageToken, 'TOKEN_HIDDEN'));
      const apiRes = await fetch(apiUrl, { headers: { 'User-Agent': 'Centxo/1.0' } });
      const apiData = await apiRes.json();

      if (apiData.error) {
        console.error('[participant-picture] Picture Endpoint error:', apiData.error);
        // Error code 100, subcode 33 = missing permissions
        // This usually means:
        // 1. App needs Advanced Access for "Business Asset User Profile Access"
        // 2. Or the participant's profile is not accessible
        // Return transparent 1x1 pixel PNG so frontend can show fallback avatar
        if (apiData.error.code === 100 && apiData.error.error_subcode === 33) {
          console.warn('[participant-picture] Facebook API permission error (code 100, subcode 33)');
          console.warn('[participant-picture] This usually means:');
          console.warn('[participant-picture] 1. App needs Advanced Access for "Business Asset User Profile Access"');
          console.warn('[participant-picture] 2. Go to: https://developers.facebook.com/apps/{app-id}/app-review/permissions/');
          console.warn('[participant-picture] 3. Request Advanced Access for "Business Asset User Profile Access"');
          console.warn('[participant-picture] Returning transparent pixel for fallback');
          const transparentPixel = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
          );
          return new NextResponse(transparentPixel, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
              'X-Picture-Error': 'permission-denied',
              'X-Picture-Error-Code': '100-33',
            },
          });
        }
        return NextResponse.json({
          error: apiData.error.message || 'Picture not found',
          code: apiData.error.code,
          subcode: apiData.error.error_subcode
        }, { status: 404 });
      }

      const data = apiData.data as { url?: string } | undefined;
      imageUrl = data?.url;
      if (imageUrl) {
        console.log('[participant-picture] Got image URL from Picture Endpoint');
      }
    }

    if (!imageUrl) {
      console.error('[participant-picture] No image URL available after both API attempts - returning transparent pixel for fallback');
      // Return transparent 1x1 pixel PNG so frontend can show fallback avatar
      const transparentPixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      return new NextResponse(transparentPixel, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          'X-Picture-Error': 'not-available',
        },
      });
    }

    console.log('[participant-picture] Fetching image from:', imageUrl.substring(0, 100) + '...');
    const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Centxo/1.0' } });
    if (!imgRes.ok) {
      console.error('[participant-picture] Failed to fetch image:', imgRes.status, imgRes.statusText);
      return NextResponse.json({ error: 'Picture not found' }, { status: 404 });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    pictureCache[picCacheKey] = { buffer, contentType, timestamp: Date.now() };
    console.log('[participant-picture] Successfully cached and returning image');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[participant-picture] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
