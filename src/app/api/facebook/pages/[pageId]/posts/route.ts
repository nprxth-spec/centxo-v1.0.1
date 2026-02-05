/**
 * GET /api/facebook/pages/[pageId]/posts
 * Fetch Page posts: feed + ads_posts (โพสต์โฆษณา) - merge & dedupe
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPageAccessToken } from '@/lib/facebook-adbox';
import { getAdboxAccessToken } from '@/app/actions/adbox';

const fields = [
  'id',
  'message',
  'created_time',
  'permalink_url',
  'full_picture',
  'attachments{media,type}',
  'likes.summary(true)',
  'comments.summary(true)',
].join(',');

function mapPost(p: Record<string, unknown>, isAdPost = false) {
  return {
    id: p.id,
    message: p.message || '',
    created_time: p.created_time,
    permalink_url: p.permalink_url,
    full_picture: p.full_picture,
    attachments: p.attachments,
    likes: (p.likes as { summary?: { total_count?: number } })?.summary?.total_count ?? 0,
    commentsCount: (p.comments as { summary?: { total_count?: number } })?.summary?.total_count ?? 0,
    isAdPost,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pageId } = await params;
    if (!pageId) {
      return NextResponse.json({ error: 'pageId required' }, { status: 400 });
    }

    const userToken = await getAdboxAccessToken();
    if (!userToken) {
      return NextResponse.json(
        { error: 'Facebook not connected. Please connect in Settings > Connections.' },
        { status: 400 }
      );
    }

    const pageToken = await getPageAccessToken(userToken, pageId);
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '25', 10), 50);

    // Fetch feed + ads_posts in parallel (โพสต์โฆษณา)
    const [feedRes, adsRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v22.0/${pageId}/feed?fields=${fields}&limit=${limit}&access_token=${pageToken}`),
      fetch(`https://graph.facebook.com/v22.0/${pageId}/ads_posts?fields=${fields}&limit=${limit}&access_token=${pageToken}`).catch(() => null),
    ]);

    const feedData = await feedRes.json();
    if (feedData.error) {
      console.error('[pages/posts] feed error:', feedData.error);
      return NextResponse.json(
        { error: feedData.error.message || 'Failed to fetch posts' },
        { status: feedData.error.code === 190 ? 401 : 400 }
      );
    }

    const feedPosts = (feedData.data || []).map((p: Record<string, unknown>) => mapPost(p, false));

    let adsPosts: Array<ReturnType<typeof mapPost>> = [];
    if (adsRes?.ok) {
      const adsData = await adsRes.json();
      if (!adsData.error && adsData.data?.length) {
        adsPosts = (adsData.data || []).map((p: Record<string, unknown>) => mapPost(p, true));
      }
    }
    // If ads_posts fails (e.g. missing permission), continue with feed only

    // Merge & dedupe by id — prefer ads_posts version (has isAdPost) for overlap
    const byId = new Map<string, ReturnType<typeof mapPost>>();
    for (const p of feedPosts) byId.set(String(p.id), p);
    for (const p of adsPosts) byId.set(String(p.id), p);

    const merged = Array.from(byId.values()).sort((a, b) => {
      const ta = new Date(String(a.created_time)).getTime();
      const tb = new Date(String(b.created_time)).getTime();
      return tb - ta;
    }).slice(0, limit);

    return NextResponse.json({ posts: merged });
  } catch (error) {
    console.error('[pages/posts]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
