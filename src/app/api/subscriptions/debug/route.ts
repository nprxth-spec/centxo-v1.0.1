/**
 * GET /api/subscriptions/debug
 * Debug endpoint to check subscription values
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, email: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get ALL subscriptions for this user (including expired)
        const subscriptions = await prisma.subscription.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        });

        console.log('📋 DEBUG - User:', user.email);
        console.log('📋 DEBUG - Subscriptions count:', subscriptions.length);
        subscriptions.forEach((sub, i) => {
            console.log(`📋 DEBUG - Sub ${i + 1}:`, {
                packageId: sub.packageId,
                type: sub.type,
                status: sub.status,
                pagesLimit: sub.pagesLimit,
                usersLimit: sub.usersLimit,
                adAccountsLimit: sub.adAccountsLimit,
                expiresAt: sub.expiresAt,
            });
        });

        return NextResponse.json({
            user: { id: user.id, email: user.email },
            subscriptionsCount: subscriptions.length,
            subscriptions: subscriptions.map(sub => ({
                packageId: sub.packageId,
                type: sub.type,
                status: sub.status,
                pagesLimit: sub.pagesLimit,
                usersLimit: sub.usersLimit,
                adAccountsLimit: sub.adAccountsLimit,
                expiresAt: sub.expiresAt,
            })),
        });
    } catch (error: any) {
        console.error('Error debugging subscription:', error);
        return NextResponse.json(
            { error: 'Failed to debug subscription' },
            { status: 500 }
        );
    }
}
