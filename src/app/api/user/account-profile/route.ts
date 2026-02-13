import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ACCOUNT_PROFILE_CACHE_TTL = 60 * 60 * 1000; // 60 min - reduce gr:get:User
declare global {
  var _accountProfileCache: Record<string, { name: string; email: string; picture: string | null; ts: number }> | undefined;
}
const accProfileCache = globalThis._accountProfileCache ?? {};
if (typeof globalThis !== 'undefined') globalThis._accountProfileCache = accProfileCache;

/**
 * Returns account profile for display on Settings > Account.
 * Uses the login provider (Facebook/Google) to show correct name, email, image.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: { select: { provider: true, access_token: true } },
        metaAccount: { select: { metaUserId: true } },
        teamMembers: {
          where: { memberType: 'facebook', facebookUserId: { not: null } },
          select: { facebookName: true, facebookEmail: true, facebookUserId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const providers = user.accounts.map((a) => a.provider);
    const primaryProvider = (session as { provider?: string }).provider || providers[0] || 'credentials';

    let displayName = user.name || 'User';
    let displayEmail = user.email || '';
    let displayImage = user.image || null;

    if (primaryProvider === 'facebook') {
      const teamMember = user.teamMembers[0];
      if (teamMember?.facebookName) displayName = teamMember.facebookName;
      if (teamMember?.facebookEmail) displayEmail = teamMember.facebookEmail;

      const cacheKey = `fb_${user.id}`;
      const cached = accProfileCache[cacheKey] && Date.now() - accProfileCache[cacheKey].ts < ACCOUNT_PROFILE_CACHE_TTL;
      if (cached) {
        displayName = accProfileCache[cacheKey].name;
        displayEmail = accProfileCache[cacheKey].email;
        displayImage = accProfileCache[cacheKey].picture;
      } else {
        const fbAccount = user.accounts.find((a) => a.provider === 'facebook');
        if (fbAccount?.access_token) {
          try {
            const res = await fetch(
              `https://graph.facebook.com/me?fields=name,email,picture&access_token=${fbAccount.access_token}`
            );
            if (res.ok) {
              const fb = await res.json();
              if (fb.name) displayName = fb.name;
              if (fb.email) displayEmail = fb.email;
              if (fb.picture?.data?.url) displayImage = fb.picture.data.url;
              accProfileCache[cacheKey] = { name: displayName, email: displayEmail, picture: displayImage, ts: Date.now() };
            }
          } catch {
            // Use TeamMember/User fallbacks above
          }
        }
      }
    } else if (primaryProvider === 'google') {
      const googleAccount = user.accounts.find((a) => a.provider === 'google');
      if (googleAccount) {
        displayName = user.name || displayName;
        displayEmail = user.email || displayEmail;
        displayImage = user.image || displayImage;
      }
    }

    return NextResponse.json({
      provider: primaryProvider,
      providers,
      displayName,
      displayEmail,
      displayImage,
    });
  } catch (error) {
    console.error('Error fetching account profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
