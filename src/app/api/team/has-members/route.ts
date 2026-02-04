import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Lightweight check: does the user have any Facebook team members?
 * Used by ads-manager/accounts to avoid blocking on full /api/team/members.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ hasMembers: false });
    }

    let hostId = user.id;

    const membershipTeam = await prisma.teamMember.findFirst({
      where: {
        memberEmail: session.user.email,
        memberType: 'email',
      },
      select: { userId: true },
    });

    if (membershipTeam) {
      hostId = membershipTeam.userId;
    }

    const count = await prisma.teamMember.count({
      where: {
        userId: hostId,
        memberType: 'facebook',
        facebookUserId: { not: null },
        accessToken: { not: null },
      },
    });

    return NextResponse.json({ hasMembers: count > 0 });
  } catch (error) {
    console.error('Error in /api/team/has-members:', error);
    return NextResponse.json({ hasMembers: false }, { status: 500 });
  }
}
