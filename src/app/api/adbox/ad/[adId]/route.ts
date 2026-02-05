/**
 * GET /api/adbox/ad/[adId]
 *
 * Fetches ad details (name, creative thumbnail, title, body) from Meta Marketing API.
 * Used to show which ad post the customer messaged from in Adbox chat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';

export const dynamic = 'force-dynamic';

async function getAdsAccessToken(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      metaAccount: { select: { accessToken: true } },
      accounts: { where: { provider: 'facebook' }, select: { access_token: true } },
    },
  });

  if (!user) return null;

  const u = user as {
    metaAccount?: { accessToken: string } | null;
    accounts?: { access_token: string | null }[];
  };

  if (u.metaAccount?.accessToken) {
    try {
      const decrypted = decryptToken(u.metaAccount.accessToken);
      if (decrypted && decrypted.length > 10) return decrypted;
    } catch {
      // skip
    }
  }

  const fbAccount = u.accounts?.[0];
  if (fbAccount?.access_token) return fbAccount.access_token;

  const sessionToken = (session as { accessToken?: string }).accessToken;
  if (sessionToken) return sessionToken;

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  const { adId } = await params;
  if (!adId) {
    return NextResponse.json({ error: 'Missing adId' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await getAdsAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        error: 'No ads token',
        ad: { id: adId, name: null, thumbnailUrl: null, title: null, body: null },
      });
    }

    // Meta Marketing API: Ad object with creative thumbnail, name, title, body
    const fields = encodeURIComponent(
      'name,creative{thumbnail_url,title,body,name}'
    );
    const url = `https://graph.facebook.com/v22.0/${adId}?fields=${fields}&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({
        error: data.error.message || 'Ad fetch failed',
        ad: { id: adId, name: null, thumbnailUrl: null, title: null, body: null },
      });
    }

    const creativeRaw = data.creative;
    const creative = Array.isArray(creativeRaw?.data)
      ? creativeRaw.data[0]
      : typeof creativeRaw === 'object' && creativeRaw !== null
        ? creativeRaw
        : null;
    const ad = {
      id: adId,
      name: data.name || null,
      thumbnailUrl: creative?.thumbnail_url || null,
      title: creative?.title || null,
      body: creative?.body || null,
      creativeName: creative?.name || null,
    };

    return NextResponse.json({ ad });
  } catch (error) {
    console.error('[adbox ad]', error);
    return NextResponse.json(
      { error: 'internal_error', ad: { id: adId, name: null, thumbnailUrl: null, title: null, body: null } },
      { status: 500 }
    );
  }
}
