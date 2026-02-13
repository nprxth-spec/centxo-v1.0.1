/**
 * GET /api/facebook/pages/[pageId]/posts
 * Fetch Page posts from published_posts and ads_posts endpoints
 * Note: /feed endpoint removed - requires pages_read_user_content permission
 * Supports cursor-based pagination via ?after= parameter
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
  'picture',
  'attachments{media{source,picture},type,subattachments{media{source,picture},type}}',
  'likes.summary(true)',
  'comments.summary(true)',
  'shares',
  'status_type',
  'is_published',
].join(',');

type MappedPost = {
  id: unknown;
  message: string;
  created_time: unknown;
  permalink_url: unknown;
  full_picture: unknown;
  picture: unknown;
  attachments: unknown;
  video_source: string | null;
  video_picture: string | null;
  video_id: string | null;
  likes: number;
  commentsCount: number;
  shares: number;
  statusType: string;
  isAdPost: boolean;
  isPublished: boolean;
};

function getFirstVideoFromAttachments(att: unknown): { source: string | null; picture: string | null; video_id: string | null } {
  const out = { source: null as string | null, picture: null as string | null, video_id: null as string | null };
  if (!att || !Array.isArray((att as { data?: unknown[] }).data)) return out;
  const data = (att as { data: unknown[] }).data;
  for (const item of data) {
    const media = (item as { media?: { source?: string; picture?: string; id?: string }; type?: string }).media;
    const type = (item as { type?: string }).type;
    if (type === 'video' || media?.source) {
      out.source = media?.source ?? out.source;
      out.picture = media?.picture ?? out.picture;
      out.video_id = media?.id ?? out.video_id;
      if (out.source || out.video_id) return out;
    }
    const sub = (item as { subattachments?: { data?: unknown[] } }).subattachments?.data;
    if (Array.isArray(sub)) {
      for (const s of sub) {
        const m = (s as { media?: { source?: string; picture?: string; id?: string }; type?: string }).media;
        const t = (s as { type?: string }).type;
        if (t === 'video' || m?.source) {
          out.source = m?.source ?? out.source;
          out.picture = m?.picture ?? out.picture;
          out.video_id = m?.id ?? out.video_id;
          if (out.source || out.video_id) return out;
        }
      }
    }
  }
  return out;
}

function mapPost(p: Record<string, unknown>, isAdPost = false): MappedPost {
  const video = getFirstVideoFromAttachments(p.attachments);
  return {
    id: p.id,
    message: (p.message as string) || '',
    created_time: p.created_time,
    permalink_url: p.permalink_url,
    full_picture: p.full_picture,
    picture: p.picture,
    attachments: p.attachments,
    video_source: video.source,
    video_picture: video.picture,
    video_id: video.video_id,
    likes: (p.likes as { summary?: { total_count?: number } })?.summary?.total_count ?? 0,
    commentsCount: (p.comments as { summary?: { total_count?: number } })?.summary?.total_count ?? 0,
    shares: (p.shares as { count?: number })?.count ?? 0,
    statusType: (p.status_type as string) || '',
    isAdPost,
    isPublished: p.is_published !== false,
  };
}

async function fetchAllPages(url: string, maxPages = 3): Promise<{ data: Record<string, unknown>[]; nextCursor?: string }> {
  const allData: Record<string, unknown>[] = [];
  let currentUrl = url;
  let nextCursor: string | undefined;

  for (let i = 0; i < maxPages; i++) {
    const res = await fetch(currentUrl);
    if (!res.ok) break;
    const json = await res.json();
    if (json.error) break;
    if (json.data?.length) {
      allData.push(...json.data);
    }
    nextCursor = json.paging?.cursors?.after;
    const nextUrl = json.paging?.next;
    if (!nextUrl) break;
    currentUrl = nextUrl;
  }

  return { data: allData, nextCursor };
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
        { error: 'Facebook not connected. Please connect in Account > Team.' },
        { status: 400 }
      );
    }

    const pageToken = await getPageAccessToken(userToken, pageId);
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 100);
    const after = req.nextUrl.searchParams.get('after') || '';
    const afterParam = after ? `&after=${after}` : '';

    // Fetch from 2 endpoints in parallel (removed /feed - requires pages_read_user_content):
    // 1. /published_posts - Posts published by the page (catches API-created posts)
    // 2. /ads_posts - Posts created as ads (dark posts etc.)
    // Note: /feed endpoint removed because it requires pages_read_user_content permission
    const [publishedResult, adsResult] = await Promise.all([
      fetchAllPages(
        `https://graph.facebook.com/v22.0/${pageId}/published_posts?fields=${fields}&limit=${limit}${afterParam}&access_token=${pageToken}`,
        after ? 1 : 2
      ).catch(() => ({ data: [], nextCursor: undefined })),
      fetchAllPages(
        `https://graph.facebook.com/v22.0/${pageId}/ads_posts?fields=${fields}&limit=${limit}&access_token=${pageToken}`,
        after ? 1 : 2
      ).catch((err) => {
        console.warn('[pages/posts] ads_posts failed (page token):', err instanceof Error ? err.message : err);
        return { data: [], nextCursor: undefined };
      }),
    ]);

    const publishedPosts = publishedResult.data.map((p) => mapPost(p, false));
    const adsPosts = adsResult.data.map((p) => mapPost(p, true));

    // Merge & dedupe by id — prefer ads_posts version (has isAdPost flag) for overlap
    const byId = new Map<string, MappedPost>();
    for (const p of publishedPosts) byId.set(String(p.id), p);
    for (const p of adsPosts) byId.set(String(p.id), p); // ads_posts takes priority

    // Fallback: fetch ad creatives from Marketing API (image + video ad posts) when no cursor
    if (!after && userToken) {
      try {
        const acctRes = await fetch(
          `https://graph.facebook.com/v22.0/me/adaccounts?fields=id&limit=50&access_token=${userToken}`
        );
        const acctData = await acctRes.json();
        const accountIds = (acctData.data ?? []).map((a: { id: string }) => a.id).filter(Boolean);
        const creativeFields = 'id,name,effective_object_story_id,image_url,thumbnail_url,title,body,video_id,actor_id,object_story_spec';
        for (const actId of accountIds.slice(0, 5)) {
          const adsUrl = `https://graph.facebook.com/v22.0/${actId}/ads?fields=creative{${creativeFields}},created_time&limit=100&access_token=${userToken}`;
          const adsRes = await fetch(adsUrl);
          const adsJson = await adsRes.json();
          if (adsJson.error) continue;
          const adsList = adsJson.data ?? [];
          for (const ad of adsList) {
            const creative = ad.creative as { id?: string; actor_id?: string; effective_object_story_id?: string; image_url?: string; thumbnail_url?: string; title?: string; body?: string; video_id?: string } | undefined;
            if (!creative || String(creative.actor_id) !== String(pageId)) continue;
            const postId = creative.effective_object_story_id || (creative.id ? `creative_${creative.id}` : undefined);
            if (!postId || byId.has(String(postId))) continue;
            const createdTime = (ad as { created_time?: string }).created_time;
            const effectivePostId = creative.effective_object_story_id;
            const [pId, fbid] = (effectivePostId || '').split('_');
            const permalink = pId && fbid ? `https://www.facebook.com/${pId}/posts/${fbid}` : null;
            byId.set(String(postId), {
              id: postId,
              message: (creative.body as string) || (creative.title as string) || '',
              created_time: createdTime || new Date().toISOString(),
              permalink_url: permalink,
              full_picture: creative.image_url || creative.thumbnail_url || null,
              picture: creative.thumbnail_url || creative.image_url || null,
              attachments: null,
              video_source: null,
              video_picture: creative.video_id ? (creative.thumbnail_url || null) : null,
              video_id: creative.video_id || null,
              likes: 0,
              commentsCount: 0,
              shares: 0,
              statusType: '',
              isAdPost: true,
              isPublished: true,
            });
          }
        }
      } catch (err) {
        console.warn('[pages/posts] Marketing API ad creatives fallback failed:', err instanceof Error ? err.message : err);
      }
    }

    const merged = Array.from(byId.values()).sort((a, b) => {
      const ta = new Date(String(a.created_time)).getTime();
      const tb = new Date(String(b.created_time)).getTime();
      return tb - ta;
    });

    // Determine if there are more posts to load
    const hasMore = !!publishedResult.nextCursor;
    const nextCursor = publishedResult.nextCursor;

    return NextResponse.json({
      posts: merged,
      paging: hasMore ? { after: nextCursor } : undefined,
      total: merged.length,
    });
  } catch (error) {
    console.error('[pages/posts]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
