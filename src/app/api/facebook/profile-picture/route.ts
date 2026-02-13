import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';
import fs from 'fs';
import path from 'path';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hr - reduce gr:get:User/picture
declare global {
  var _profilePictureCache: Record<string, { buffer: ArrayBuffer; contentType: string; timestamp: number }> | undefined;
}
const picCache = globalThis._profilePictureCache ?? {};
if (typeof globalThis !== 'undefined') globalThis._profilePictureCache = picCache;

/**
 * Proxy for Facebook profile pictures - fetches server-side, caches to reduce quota.
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
      // Find ANY MetaAccount with this metaUserId, then check if current user is in their team
      const metaAccounts = await prisma.metaAccount.findMany({
        where: { metaUserId: userId },
        select: { userId: true, accessToken: true },
      });

      for (const ma of metaAccounts) {
        // Option A: Current user is the owner
        if (ma.userId === user.id) {
          token = ma.accessToken;
          break;
        }

        // Option B: Current user and owner share a host
        // Find host for current user
        const currentUserMember = await prisma.teamMember.findFirst({
          where: { memberEmail: session.user.email, memberType: 'email' },
          select: { userId: true },
        });
        const currentUserHost = currentUserMember?.userId ?? user.id;

        // Find host for MetaAccount owner
        const ownerUser = await prisma.user.findUnique({
          where: { id: ma.userId },
          select: { email: true },
        });
        const ownerMember = ownerUser?.email ? await prisma.teamMember.findFirst({
          where: { memberEmail: ownerUser.email, memberType: 'email' },
          select: { userId: true },
        }) : null;
        const ownerHost = ownerMember?.userId ?? ma.userId;

        if (currentUserHost === ownerHost) {
          token = ma.accessToken;
          break;
        }
      }

      if (token) {
        try {
          const { decryptToken } = await import('@/lib/services/metaClient');
          token = decryptToken(token);
        } catch {
          // Fallback if not encrypted or decryption fails
        }
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'No access' }, { status: 403 });
    }

    const cacheDir = path.join(process.cwd(), 'storage', 'profile-pics');
    const cacheFilePath = path.join(cacheDir, `${userId}.img`);
    const cacheMetaPath = path.join(cacheDir, `${userId}.meta`);

    // Check File Cache
    try {
      if (fs.existsSync(cacheFilePath) && fs.existsSync(cacheMetaPath)) {
        const stats = fs.statSync(cacheFilePath);
        if (Date.now() - stats.mtimeMs < CACHE_TTL) {
          const buffer = fs.readFileSync(cacheFilePath);
          const contentType = fs.readFileSync(cacheMetaPath, 'utf8');
          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
              'X-Cache': 'HIT-FS'
            },
          });
        }
      }
    } catch (err) {
      console.warn('[profile-picture] cache read error:', err);
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

    // Save to File Cache
    try {
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFilePath, Buffer.from(buffer));
      fs.writeFileSync(cacheMetaPath, contentType);
    } catch (err) {
      console.warn('[profile-picture] cache write error:', err);
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'MISS'
      },
    });
  } catch (error) {
    console.error('[profile-picture]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
