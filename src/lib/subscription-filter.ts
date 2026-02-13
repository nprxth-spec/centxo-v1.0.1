import { prisma } from '@/lib/prisma';
import { getEffectiveHostId } from '@/lib/team-utils';

export type SubscriptionPool = {
    pageIds: string[];
    adAccountIds: string[];
};

/**
 * Retrieves the asset IDs (pages and ad accounts) selected in the host's active subscription.
 * If no active subscription is found, returns empty arrays.
 */
export async function getSubscriptionPool(userId: string, email?: string): Promise<SubscriptionPool> {
    const hostId = await getEffectiveHostId(userId, email);

    const subscription = await prisma.subscription.findFirst({
        where: {
            userId: hostId,
            status: { in: ['active', 'trial'] },
            expiresAt: { gte: new Date() },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
            selectedPageIds: true,
            selectedAdAccountIds: true,
        },
    });

    if (!subscription) {
        return { pageIds: [], adAccountIds: [] };
    }

    const safeParse = (raw: string | null): string[] => {
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    return {
        pageIds: safeParse(subscription.selectedPageIds),
        adAccountIds: safeParse(subscription.selectedAdAccountIds),
    };
}
