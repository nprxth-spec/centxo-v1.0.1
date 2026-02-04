import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    req: NextRequest,
    // Next.js 15: params is a Promise
    props: { params: Promise<{ memberId: string }> }
) {
    try {
        const params = await props.params;
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const memberId = params.memberId;

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Get team member
        const member = await (prisma as any).teamMember.findUnique({
            where: { id: memberId },
        });

        if (!member) {
            return NextResponse.json(
                { error: 'Team member not found' },
                { status: 404 }
            );
        }

        // Verify ownership
        if (member.userId !== user.id) {
            return NextResponse.json(
                { error: 'Not authorized to remove this member' },
                { status: 403 }
            );
        }

        // Delete team member
        await (prisma as any).teamMember.delete({
            where: { id: memberId },
        });

        return NextResponse.json({
            success: true,
            message: 'Team member removed successfully',
        });
    } catch (error) {
        console.error('Error removing team member:', error);
        return NextResponse.json(
            { error: 'Failed to remove team member' },
            { status: 500 }
        );
    }
}
