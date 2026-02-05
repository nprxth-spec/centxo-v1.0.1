/**
 * DELETE /api/facebook/comments/[commentId]
 * Delete a comment on a Page post - requires pages_manage_engagement
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPageAccessToken } from '@/lib/facebook-adbox';
import { getAdboxAccessToken } from '@/app/actions/adbox';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId } = await params;
    const pageId = req.nextUrl.searchParams.get('pageId');
    if (!commentId || !pageId) {
      return NextResponse.json({ error: 'commentId and pageId required' }, { status: 400 });
    }

    const userToken = await getAdboxAccessToken();
    if (!userToken) {
      return NextResponse.json(
        { error: 'Facebook not connected' },
        { status: 400 }
      );
    }

    const pageToken = await getPageAccessToken(userToken, pageId);
    const url = `https://graph.facebook.com/v22.0/${commentId}?access_token=${pageToken}`;
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));

    if (data.error) {
      console.error('[comments/delete] Graph error:', data.error);
      return NextResponse.json(
        { error: data.error.message || 'Failed to delete comment' },
        { status: data.error.code === 190 ? 401 : 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[comments/delete]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
