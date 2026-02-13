/**
 * GET /api/facebook/posts/[postId]/comments
 * Fetch comments - use User token to get commenter names (Page token often returns empty from)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPageAccessToken } from '@/lib/facebook-adbox';
import { getAdboxAccessToken } from '@/app/actions/adbox';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await params;
    const pageId = req.nextUrl.searchParams.get('pageId');
    if (!postId || !pageId) {
      return NextResponse.json({ error: 'postId and pageId required' }, { status: 400 });
    }

    const userToken = await getAdboxAccessToken();
    if (!userToken) {
      return NextResponse.json(
        { error: 'Facebook not connected' },
        { status: 400 }
      );
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 100);
    const fields = 'id,message,from{name,id},created_time,like_count,comment_count';

    // Try User token first - often returns from.name; Page token may return empty from
    let url = `https://graph.facebook.com/v22.0/${postId}/comments?fields=${fields}&limit=${limit}&order=reverse_chronological&filter=stream&access_token=${userToken}`;
    let res = await fetch(url);
    let data = await res.json();

    if (data.error && (data.error.code === 200 || data.error.code === 190)) {
      const pageToken = await getPageAccessToken(userToken, pageId);
      url = `https://graph.facebook.com/v22.0/${postId}/comments?fields=${fields}&limit=${limit}&order=reverse_chronological&filter=stream&access_token=${pageToken}`;
      res = await fetch(url);
      data = await res.json();
    }

    if (data.error) {
      console.error('[posts/comments] Graph error:', data.error);
      return NextResponse.json(
        { error: data.error.message || 'Failed to fetch comments' },
        { status: data.error.code === 190 ? 401 : 400 }
      );
    }

    const comments = (data.data || []).map((c: Record<string, unknown>) => ({
      id: c.id,
      message: c.message || '',
      from: c.from,
      created_time: c.created_time,
      like_count: (c.like_count as number) ?? 0,
      comment_count: (c.comment_count as number) ?? 0,
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('[posts/comments]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
