/**
 * Subscription Utilities
 * Helper functions for managing user subscriptions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate a unique 6-character Centxo ID
 */
function generatePackageId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Create a trial subscription for a new user
 * Standard plan with 14-day free trial
 */
export async function createTrialSubscription(userId: string) {
    const TRIAL_DAYS = 14;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

    // Generate unique 6-char Centxo ID
    let packageId = generatePackageId();

    // Ensure uniqueness (retry if collision)
    let attempts = 0;
    while (attempts < 5) {
        const existing = await prisma.subscription.findUnique({
            where: { packageId },
        });
        if (!existing) break;
        packageId = generatePackageId();
        attempts++;
    }

    // Create subscription record
    const subscription = await prisma.subscription.create({
        data: {
            packageId,
            userId,
            name: "Standard Trial",
            type: "standard",
            pagesLimit: 3,
            usersLimit: 1,
            adAccountsLimit: 5,
            amount: 0, // Free trial
            durationMonths: 0,
            status: "trial",
            startDate: new Date(),
            expiresAt,
            autoRenew: false,
        },
    });

    // Ensure User.plan is set to FREE (trial has FREE plan limits)
    // This ensures consistency with plan-limits.ts checks
    await prisma.user.update({
        where: { id: userId },
        data: { plan: 'FREE' },
    }).catch((err) => {
        // Log but don't fail if user update fails
        console.warn('Failed to update User.plan for trial subscription:', err);
    });

    return subscription;
}

/**
 * Check if user already has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findFirst({
        where: {
            userId,
            status: { in: ['active', 'trial'] },
            expiresAt: { gte: new Date() },
        },
    });
    return !!subscription;
}
