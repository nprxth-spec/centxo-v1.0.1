/**
 * PATCH /api/subscriptions/fix-trial
 * Fix existing trial subscriptions to have correct Standard plan limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function PATCH(req: NextRequest) {
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
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Update all trial subscriptions for this user with correct Standard plan limits
        const result = await prisma.subscription.updateMany({
            where: {
                userId: user.id,
                status: 'trial',
                type: 'standard',
            },
            data: {
                pagesLimit: 3,
                usersLimit: 0,
                adAccountsLimit: 5,
            },
        });

        return NextResponse.json({
            success: true,
            message: `Updated ${result.count} trial subscription(s) with correct limits`,
            limits: {
                pagesLimit: 3,
                usersLimit: 0,
                adAccountsLimit: 5,
            }
        });
    } catch (error: any) {
        console.error('Error fixing trial subscription:', error);
        return NextResponse.json(
            { error: 'Failed to fix trial subscription' },
            { status: 500 }
        );
    }
}
