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

    // Must have at least one TeamMember with valid (non-expired) token - matches team/config logic
    const validMembers = await prisma.teamMember.findMany({
      where: {
        userId: hostId,
        memberType: 'facebook',
        facebookUserId: { not: null },
        accessToken: { not: null },
        OR: [
          { accessTokenExpires: null },
          { accessTokenExpires: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });

    if (validMembers.length > 0) {
      return NextResponse.json({ hasMembers: true });
    }

    // Fallback: MetaAccount (same logic as team/config) - user may have connected via Meta OAuth without TeamMember
    const metaAccount = await prisma.metaAccount.findUnique({
      where: { userId: hostId },
      select: { accessToken: true, accessTokenExpires: true },
    });
    const hasValidMetaAccount = !!(
      metaAccount?.accessToken &&
      metaAccount.accessTokenExpires &&
      new Date(metaAccount.accessTokenExpires) > new Date()
    );

    console.log(`[team/has-members-debug] hostId: ${hostId}, hasValidMetaAccount: ${hasValidMetaAccount}`);

    if (hasValidMetaAccount) {
      return NextResponse.json({ hasMembers: true });
    }

    // Last fallback: NextAuth Account (facebook provider)
    const fbAccount = await prisma.account.findFirst({
      where: { userId: hostId, provider: 'facebook', access_token: { not: null } },
      select: { id: true },
    });

    console.log(`[team/has-members-debug] NextAuth Account fallback for hostId ${hostId}: ${!!fbAccount}`);

    return NextResponse.json({ hasMembers: !!fbAccount });
  } catch (error) {
    console.error('Error in /api/team/has-members:', error);
    return NextResponse.json({ hasMembers: false }, { status: 500 });
  }
}
