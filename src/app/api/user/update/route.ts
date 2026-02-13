import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';

export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        // Update user in database
        const updatedUser = await prisma.user.update({
            where: { email: session.user.email },
            data: { name },
        });

        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
            userId: session.user.id,
            action: 'UPDATE_USER_PROFILE',
            details: { name: updatedUser.name, email: updatedUser.email },
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            success: true,
            user: {
                name: updatedUser.name,
                email: updatedUser.email,
                image: updatedUser.image,
            },
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { error: 'Failed to update user' },
            { status: 500 }
        );
    }
}
