/**
 * POST /api/team/add-email-member
 * Add a team member by email
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTeamMemberLimit } from '@/lib/plan-limits';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Identify Host
    let hostId = session.user.id;
    let isAdmin = false;

    const membership = await prisma.teamMember.findFirst({
      where: { memberEmail: user.email, memberType: 'email' },
      include: { user: { select: { plan: true } } }
    });

    if (membership) {
      if (membership.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only Admins or the Team Owner can add members' }, { status: 403 });
      }
      hostId = membership.userId;
      isAdmin = true;
    }

    const hostPlan = membership?.user?.plan || user.plan || 'FREE';
    const limit = getTeamMemberLimit(hostPlan);

    const memberCount = await prisma.teamMember.count({
      where: { userId: hostId, memberType: 'email' },
    });

    if (memberCount >= limit) {
      return NextResponse.json(
        { error: `The team plan allows up to ${limit} team member(s). Please upgrade to add more.` },
        { status: 403 }
      );
    }

    const { email, name, role } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Validate role - only ADMIN or EMPLOYEE allowed
    const validRoles = ['ADMIN', 'EMPLOYEE'];
    const memberRole = validRoles.includes(role) ? role : 'EMPLOYEE';

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email already exists in ANY team
    // User requirement: If user is already in a team, they cannot be added to another team
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        memberEmail: email,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (existingMember) {
      const ownerName = existingMember.user.name || existingMember.user.email || 'another team leader';
      return NextResponse.json(
        { error: `This email is already a member of ${ownerName}'s team` },
        { status: 400 }
      );
    }

    // Create team member
    const teamMember = await prisma.teamMember.create({
      data: {
        userId: hostId,
        memberType: 'email',
        memberEmail: email,
        memberName: name,
        role: memberRole,
      },
    });

    return NextResponse.json({
      success: true,
      member: {
        id: teamMember.id,
        memberType: teamMember.memberType,
        memberEmail: teamMember.memberEmail,
        memberName: teamMember.memberName,
        role: teamMember.role,
        addedAt: teamMember.addedAt,
      },
    });
  } catch (error) {
    console.error('Error adding email team member:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    );
  }
}
