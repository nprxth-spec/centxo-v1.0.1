import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

        const body = await req.json();
        const { provider } = body;

        if (!provider) {
            return NextResponse.json(
                { error: 'Provider is required' },
                { status: 400 }
            );
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                accounts: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if user has multiple accounts
        if (user.accounts.length <= 1) {
            return NextResponse.json(
                { error: 'Cannot disconnect the only login method' },
                { status: 400 }
            );
        }

        // Delete the account
        await prisma.account.deleteMany({
            where: {
                userId: user.id,
                provider: provider,
            },
        });

        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
            userId: user.id,
            action: 'DISCONNECT_ACCOUNT',
            details: { provider, email: user.email },
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            success: true,
            message: `Successfully disconnected ${provider}`,
        });
    } catch (error) {
        console.error('Error disconnecting account:', error);
        return NextResponse.json(
            { error: 'Failed to disconnect account' },
            { status: 500 }
        );
    }
}
