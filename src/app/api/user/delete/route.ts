import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const userEmail = session.user.email;

        // Delete user and all related data (cascade delete)
        await prisma.user.delete({
            where: { id: userId }
        });

        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
            userId,
            action: 'USER_DELETE',
            details: { email: userEmail },
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error: any) {
        console.error('Error deleting account:', error);
        return NextResponse.json({
            error: 'Failed to delete account',
            details: error.message
        }, { status: 500 });
    }
}
