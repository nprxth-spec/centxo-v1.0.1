import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';

/**
 * Proxy for Facebook profile pictures - fetches server-side to avoid CORS/referrer issues.
 * GET /api/facebook/profile-picture?userId=FB_USER_ID
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let token: string | null = null;

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        memberType: 'facebook',
        facebookUserId: userId,
        accessToken: { not: null },
      },
      select: { accessToken: true },
    });
    if (teamMember?.accessToken) token = teamMember.accessToken;

    if (!token) {
      const memberRecord = await prisma.teamMember.findFirst({
        where: { memberEmail: session.user.email, memberType: 'email' },
        select: { userId: true },
      });
      const ownerId = memberRecord?.userId ?? user.id;
      const ownerMember = await prisma.teamMember.findFirst({
        where: {
          userId: ownerId,
          memberType: 'facebook',
          facebookUserId: userId,
          accessToken: { not: null },
        },
        select: { accessToken: true },
      });
      if (ownerMember?.accessToken) token = ownerMember.accessToken;
    }

    if (!token) {
      const memberRecord = await prisma.teamMember.findFirst({
        where: { memberEmail: session.user.email, memberType: 'email' },
        select: { userId: true },
      });
      const ownerId = memberRecord?.userId ?? user.id;
      const metaAccount = await prisma.metaAccount.findFirst({
        where: { userId: ownerId, metaUserId: userId },
        select: { accessToken: true },
      });
      if (metaAccount?.accessToken) {
        try {
          token = decryptToken(metaAccount.accessToken);
        } catch {
          token = metaAccount.accessToken;
        }
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'No access' }, { status: 403 });
    }

    const graphRes = await fetch(
      `https://graph.facebook.com/v22.0/${userId}?fields=picture.type(large)&access_token=${token}`
    );
    const graphData = await graphRes.json();
    const pictureUrl = graphData?.picture?.data?.url;

    if (!pictureUrl) {
      return NextResponse.json({ error: 'Picture not found' }, { status: 404 });
    }

    const imgRes = await fetch(pictureUrl, { headers: { 'User-Agent': 'Centxo/1.0' } });
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[profile-picture]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
