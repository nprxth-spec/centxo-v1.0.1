/**
 * PATCH /api/team/update-member-role
 * Update a team member's role (Owner/Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { memberId, role } = await request.json();

        if (!memberId || !role) {
            return NextResponse.json(
                { error: 'Member ID and role are required' },
                { status: 400 }
            );
        }

        // Validate role
        const validRoles = ['ADMIN', 'EMPLOYEE'];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be ADMIN or EMPLOYEE' },
                { status: 400 }
            );
        }

        // Check if the member exists and belongs to the current user's team
        const member = await prisma.teamMember.findFirst({
            where: {
                id: memberId,
                userId: session.user.id,
            },
        });

        if (!member) {
            return NextResponse.json(
                { error: 'Member not found or not in your team' },
                { status: 404 }
            );
        }

        // Update the member's role
        const updatedMember = await prisma.teamMember.update({
            where: { id: memberId },
            data: { role },
        });

        return NextResponse.json({
            success: true,
            member: {
                id: updatedMember.id,
                role: updatedMember.role,
            },
        });
    } catch (error) {
        console.error('Error updating member role:', error);
        return NextResponse.json(
            { error: 'Failed to update member role' },
            { status: 500 }
        );
    }
}
