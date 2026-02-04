import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { decryptToken } from '@/lib/services/metaClient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const adAccountIdParam = searchParams.get('adAccountId');
    const limitParam = searchParams.get('limit');

    if (!adAccountIdParam) {
      return NextResponse.json({ error: 'Ad Account ID is required' }, { status: 400 });
    }

    const cleanId = adAccountIdParam.replace(/^act_/, '');
    const actId = `act_${cleanId}`;

    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        metaAccount: { select: { accessToken: true } },
        accounts: {
          where: { provider: 'facebook' },
          select: { access_token: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tokens: TokenInfo[] = [];

    // 1. MetaAccount token (encrypted)
    if ((user as any).metaAccount?.accessToken) {
      try {
        const decrypted = decryptToken((user as any).metaAccount.accessToken);
        tokens.push({ token: decrypted, name: user.name || 'Main Account' });
      } catch (e) {
        console.error('[facebook/ad-videos] Failed to decrypt MetaAccount token:', e);
        // Fallback to raw in case it's stored unencrypted
        tokens.push({ token: (user as any).metaAccount.accessToken, name: user.name || 'Main Account (raw)' });
      }
    }

    // 2. NextAuth Facebook account tokens
    if ((user as any).accounts) {
      (user as any).accounts.forEach((acc: any) => {
        if (acc.access_token && !tokens.some(t => t.token === acc.access_token)) {
          tokens.push({ token: acc.access_token, name: user.name || 'Account' });
        }
      });
    }

    // 3. Team member / owner tokens (reuse logic from campaigns route)
    const memberRecord = await prisma.teamMember.findFirst({
      where: { memberEmail: session.user.email },
    });

    let teamOwnerId = user.id;
    if (memberRecord?.userId) {
      teamOwnerId = memberRecord.userId;
    }

    const teamOwner = await prisma.user.findUnique({
      where: { id: teamOwnerId },
      include: {
        metaAccount: { select: { accessToken: true } },
        accounts: {
          where: { provider: 'facebook' },
          select: { access_token: true },
        },
      },
    });

    if (teamOwner?.metaAccount?.accessToken && teamOwnerId !== user.id) {
      try {
        const decrypted = decryptToken(teamOwner.metaAccount.accessToken);
        if (!tokens.some(t => t.token === decrypted)) {
          tokens.push({ token: decrypted, name: teamOwner.name || 'Team Owner' });
        }
      } catch (e) {
        console.error('[facebook/ad-videos] Failed to decrypt team owner MetaAccount token:', e);
      }
    }

    if (teamOwner?.accounts) {
      teamOwner.accounts.forEach((acc: any) => {
        if (acc.access_token && !tokens.some(t => t.token === acc.access_token)) {
          tokens.push({ token: acc.access_token, name: teamOwner.name || 'Team Owner Account' });
        }
      });
    }

    const teamMembers = await prisma.teamMember.findMany({
      where: {
        userId: teamOwnerId,
        memberType: 'facebook',
        facebookUserId: { not: null },
        accessToken: { not: null },
      },
    });

    teamMembers.forEach((member: any) => {
      if (member.accessToken && !tokens.some(t => t.token === member.accessToken)) {
        tokens.push({ token: member.accessToken, name: member.facebookName || 'Team Member' });
      }
    });

    const sessionToken = (session as any).accessToken;
    if (sessionToken && !tokens.some(t => t.token === sessionToken)) {
      tokens.push({ token: sessionToken, name: 'Session' });
    }

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected', videos: [] },
        { status: 400 }
      );
    }

    const token = await getValidTokenForAdAccount(actId, tokens);
    if (!token) {
      return NextResponse.json(
        { error: 'No valid access token found for this ad account', videos: [] },
        { status: 400 }
      );
    }

    const limit = Math.min(100, Math.max(1, parseInt(limitParam || '30', 10) || 30));

    const url = new URL(`https://graph.facebook.com/v22.0/${actId}/advideos`);
    // Request 'title' for video name, 'picture' (larger) as alternative thumbnail, and multiple thumbnail sizes
    url.searchParams.set('fields', 'id,title,source,created_time,permalink_url,content_category,length,thumbnail_url,picture,thumbnails');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('access_token', token);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('[facebook/ad-videos] Graph error:', data.error || data);
      return NextResponse.json(
        { error: data.error?.message || 'Failed to fetch ad videos', videos: [] },
        { status: 400 }
      );
    }

    const videos = (data.data || []).map((v: any) => {
      // Prefer picture over thumbnail_url; fallback to thumbnails array
      let thumbnailSrc = v.picture || v.thumbnail_url;
      if (!thumbnailSrc && v.thumbnails?.data?.length) {
        // Pick largest available thumbnail
        const sorted = [...v.thumbnails.data].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
        thumbnailSrc = sorted[0]?.uri;
      }
      return {
        id: v.id,
        title: v.title || null, // Video name
        source: v.source,
        thumbnail: thumbnailSrc,
        created_time: v.created_time,
        permalink_url: v.permalink_url,
        length: v.length,
      };
    });

    return NextResponse.json({ videos, count: videos.length });
  } catch (error: any) {
    console.error('[facebook/ad-videos] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ad videos', videos: [] },
      { status: 500 }
    );
  }
}

