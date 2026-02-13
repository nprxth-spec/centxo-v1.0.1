import { prisma } from '@/lib/prisma';
import { getPlanLimits } from '@/lib/plan-limits';

export const MAX_FREE_TRIAL_DAYS = 14;

export interface AiLimitCheckResult {
    allowed: boolean;
    reason?: string;
    limit: number;
    usage: number;
    isTrialExpired?: boolean;
}

/**
 * Check if a user can generate AI content based on their plan limits.
 */
export async function checkAiLimit(userId: string): Promise<AiLimitCheckResult> {
    if (!userId) return { allowed: false, reason: 'Invalid User ID', limit: 0, usage: 0 };

    const userPromise = prisma.user.findUnique({
        where: { id: userId },
        select: {
            plan: true,
            // @ts-ignore
            aiUsageCount: true,
            // @ts-ignore
            aiUsageResetAt: true,
            createdAt: true
        }
    });

    const user = await userPromise as any;

    if (!user) {
        console.error(`❌ checkAiLimit: User not found in DB. ID: ${userId}`);
        return { allowed: false, reason: 'User not found', limit: 0, usage: 0 };
    }

    const limits = getPlanLimits(user.plan);

    // Check if plan has AI access first
    if (!limits.aiAccess) {
        return {
            allowed: false,
            reason: 'AI features require PLUS or PRO plan. Please upgrade to continue.',
            limit: 0,
            usage: 0
        };
    }

    const limit = limits.aiGenerations;

    // 1. Check Trial (FREE Plan) - Disable trial check to allow AI for all
    // if (user.plan === 'FREE') {
    //     const trialEnd = new Date(user.createdAt);
    //     trialEnd.setDate(trialEnd.getDate() + MAX_FREE_TRIAL_DAYS);

    //     if (new Date() > trialEnd) {
    //         return {
    //             allowed: false,
    //             reason: 'Trial expired. Please upgrade to continue.',
    //             isTrialExpired: true,
    //             limit,
    //             usage: user.aiUsageCount || 0
    //         };
    //     }
    // }

    // 2. Check Monthly Reset (PLUS/PRO) simulation
    // If usageResetAt is in the past, effectively usage is 0 for checking purposes
    let currentUsage = user.aiUsageCount || 0;
    if (user.plan !== 'FREE' && user.aiUsageResetAt && new Date() > user.aiUsageResetAt) {
        currentUsage = 0;
    }

    if (currentUsage >= limit) {
        return { allowed: false, reason: 'Monthly AI limit reached.', limit, usage: currentUsage };
    }

    return { allowed: true, limit, usage: currentUsage };
}

/**
 * Increment AI usage count for a user. Handles monthly reset logic.
 */
export async function incrementAiUsage(userId: string) {
    const userPromise = prisma.user.findUnique({
        where: { id: userId },
        select: {
            // @ts-ignore
            aiUsageCount: true,
            // @ts-ignore
            aiUsageResetAt: true,
            plan: true,
            createdAt: true
        }
    });

    const user = await userPromise as any;

    if (!user) return;

    let newCount = (user.aiUsageCount || 0) + 1;
    let newResetAt = user.aiUsageResetAt;

    // Handle Reset Logic for Paid Plans
    if (user.plan !== 'FREE') {
        const now = new Date();

        // If first time or past due, reset
        if (!user.aiUsageResetAt || now > user.aiUsageResetAt) {
            newCount = 1;

            // Set next reset date (next month same day)
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            newResetAt = nextMonth;
        }
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            // @ts-ignore
            aiUsageCount: newCount,
            // @ts-ignore
            aiUsageResetAt: newResetAt
        } as any
    });
}
