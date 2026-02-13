/**
 * POST /api/subscriptions/ensure-trial
 * Ensure user has a trial subscription - creates one if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createTrialSubscription, hasActiveSubscription } from '@/lib/subscription-utils';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
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

        // Check if user already has a subscription
        const hasSubscription = await hasActiveSubscription(user.id);

        if (hasSubscription) {
            // Get existing subscription to return
            const existing = await prisma.subscription.findFirst({
                where: {
                    userId: user.id,
                    status: { in: ['active', 'trial'] },
                    expiresAt: { gte: new Date() },
                },
            });
            return NextResponse.json({
                success: true,
                message: 'User already has an active subscription',
                subscription: existing,
                created: false,
            });
        }

        // Create new trial subscription
        const subscription = await createTrialSubscription(user.id);
        console.log('✅ Created trial subscription for user:', user.email);

        return NextResponse.json({
            success: true,
            message: 'Trial subscription created',
            subscription,
            created: true,
        });
    } catch (error: any) {
        console.error('Error ensuring trial subscription:', error);
        return NextResponse.json(
            { error: 'Failed to ensure trial subscription' },
            { status: 500 }
        );
    }
}
