import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getTokenForAdVideos } from '../lib-token';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, context: { params: Promise<{ videoId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let videoIdTrim = '';
    try {
      const p = await context.params;
      videoIdTrim = (p?.videoId ?? '').trim();
    } catch {
      /* params Promise rejected */
    }
    if (!videoIdTrim) {
      const match = request.nextUrl?.pathname?.match(/\/api\/facebook\/ad-videos\/([^/?]+)/);
      videoIdTrim = (match?.[1] ?? '').trim();
    }
    if (!videoIdTrim) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const adAccountIdParam = searchParams.get('adAccountId');
    if (!adAccountIdParam) {
      return NextResponse.json({ error: 'adAccountId is required' }, { status: 400 });
    }

    const clean = adAccountIdParam.replace(/^act_/, '');
    const actId = `act_${clean}`;
    const token = await getTokenForAdVideos(actId);
    if (!token) {
      return NextResponse.json(
        { error: 'No valid access token for this ad account' },
        { status: 400 }
      );
    }

    // Dissociate video from ad account: DELETE /act_XXX/advideos?video_id=YYY
    const params = new URLSearchParams({
      video_id: videoIdTrim,
      access_token: token,
    });
    const url = `https://graph.facebook.com/v22.0/${actId}/advideos?${params.toString()}`;
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      const msg = data.error?.message || data.error?.error_user_msg || 'Delete failed';
      console.error('[facebook/ad-videos] DELETE Graph error:', data.error);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted: videoIdTrim });
  } catch (e: any) {
    console.error('[facebook/ad-videos] DELETE error:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to delete video' },
      { status: 500 }
    );
  }
}
