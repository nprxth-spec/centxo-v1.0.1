import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { TeamMember as TeamMemberModel } from '@prisma/client';

/**
 * Combined Connections API - inline DB queries, no internal HTTP fetches.
 * Returns launch + team members immediately. Client fetches pictures separately in background.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        metaAccount: true,
        accounts: { where: { provider: 'facebook' }, select: { id: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hasMetaAccount = !!user.metaAccount;
    const hasFacebookAccount = (user.accounts?.length ?? 0) > 0;
    const isMetaConnected = hasMetaAccount || hasFacebookAccount;

    const launchData = {
      ready: isMetaConnected && !!user.metaAccount?.adAccountId && !!user.metaAccount?.pageId,
      checks: {
        metaConnected: isMetaConnected,
        adAccountSelected: !!user.metaAccount?.adAccountId,
        pageSelected: !!user.metaAccount?.pageId,
      },
      metaAccount: user.metaAccount
        ? { adAccountName: user.metaAccount.adAccountName, pageName: user.metaAccount.pageName }
        : null,
    };

    const membershipTeam = await prisma.teamMember.findFirst({
      where: { memberEmail: session.user.email, memberType: 'email' },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    let host: { id: string; name: string | null; email: string | null; image: string | null; role: string };
    let teamMembers: TeamMemberModel[];

    if (membershipTeam) {
      host = {
        id: membershipTeam.user.id,
        name: membershipTeam.user.name,
        email: membershipTeam.user.email,
        image: membershipTeam.user.image,
        role: 'OWNER',
      };
      teamMembers = await prisma.teamMember.findMany({
        where: { userId: membershipTeam.userId },
        orderBy: { addedAt: 'asc' },
      });
    } else {
      host = {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: 'OWNER',
      };
      teamMembers = await prisma.teamMember.findMany({
        where: { userId: user.id },
        orderBy: { addedAt: 'asc' },
      });
    }

    const members = await Promise.all(
      teamMembers.map(async (m) => {
        let memberImage: string | null = null;
        if (m.memberType === 'email' && m.memberEmail) {
          const u = await prisma.user.findUnique({
            where: { email: m.memberEmail.trim() },
            select: { image: true },
          });
          memberImage = u?.image ?? null;
        } else if (m.memberType === 'facebook' && m.facebookUserId) {
          memberImage = `/api/facebook/profile-picture?userId=${encodeURIComponent(m.facebookUserId)}`;
        }
        return {
          id: m.id,
          memberType: m.memberType,
          facebookUserId: m.facebookUserId,
          facebookName: m.facebookName,
          facebookEmail: m.facebookEmail,
          memberEmail: m.memberEmail,
          memberName: m.memberName,
          memberImage,
          role: m.role,
          addedAt: m.addedAt,
          lastUsedAt: m.lastUsedAt,
        };
      })
    );

    if (user.metaAccount && !members.some((m) => m.memberType === 'facebook' && m.facebookUserId === user.metaAccount?.metaUserId)) {
      let fbName = user.name || 'Facebook Account';
      let fbEmail = user.email;
      try {
        const fbAccount = await prisma.account.findFirst({
          where: { userId: user.id, provider: 'facebook' },
          select: { access_token: true },
        });
        if (fbAccount?.access_token) {
          const res = await fetch(
            `https://graph.facebook.com/me?fields=name,email&access_token=${fbAccount.access_token}`
          );
          if (res.ok) {
            const fb = await res.json();
            if (fb.name) fbName = fb.name;
            if (fb.email) fbEmail = fb.email;
          }
        }
      } catch {
        // Use fallbacks above
      }
      members.unshift({
        id: `meta-${user.metaAccount.id}`,
        memberType: 'facebook',
        facebookUserId: user.metaAccount.metaUserId,
        facebookName: fbName,
        facebookEmail: fbEmail,
        memberEmail: null,
        memberName: null,
        memberImage: `/api/facebook/profile-picture?userId=${encodeURIComponent(user.metaAccount.metaUserId)}`,
        role: 'MEMBER',
        addedAt: user.metaAccount.createdAt,
        lastUsedAt: user.metaAccount.updatedAt,
      });
    }

    return NextResponse.json({
      launch: launchData,
      team: { host, members },
      facebookProfile: null,
      facebookPictures: [],
    });
  } catch (err) {
    console.error('Error in /api/connections/data:', err);
    return NextResponse.json(
      { error: 'Failed to fetch connections data' },
      { status: 500 }
    );
  }
}
