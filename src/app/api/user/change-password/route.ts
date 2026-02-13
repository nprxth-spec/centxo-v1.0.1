import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { currentPassword, newPassword } = await req.json();

        if (!newPassword || newPassword.length < 8) {
            return NextResponse.json(
                { error: 'New password must be at least 8 characters' },
                { status: 400 }
            );
        }

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

        // If user has existing password, verify current password
        if (user.password) {
            if (!currentPassword) {
                return NextResponse.json(
                    { error: 'Current password is required' },
                    { status: 400 }
                );
            }

            const isValid = await bcrypt.compare(currentPassword, user.password);
            if (!isValid) {
                return NextResponse.json(
                    { error: 'Current password is incorrect' },
                    { status: 400 }
                );
            }
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { email: session.user.email },
            data: { password: hashedPassword },
        });

        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
            userId: user.id,
            action: user.password ? 'PASSWORD_CHANGE' : 'PASSWORD_ADD',
            details: { email: user.email },
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            success: true,
            message: user.password ? 'Password updated successfully' : 'Password set successfully',
        });
    } catch (error) {
        console.error('Error updating password:', error);
        return NextResponse.json(
            { error: 'Failed to update password' },
            { status: 500 }
        );
    }
}
