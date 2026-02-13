import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Generate unique 6-char package ID
function generatePackageId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// GET - List user's subscriptions
export async function GET(req: NextRequest) {
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

        // 1. Identify the Host (Owner of the team this user belongs to)
        const { getEffectiveHostId } = await import('@/lib/team-utils');
        const hostId = await getEffectiveHostId(user.id, session.user.email);

        // 2. Fetch subscriptions for the host (Owner)
        const subscriptions = await prisma.subscription.findMany({
            where: { userId: hostId },
            orderBy: { createdAt: 'desc' },
        });

        function safeParseIds(raw: string | null | undefined): string[] {
            if (raw == null || raw === '') return [];
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }

        // Parse JSON fields and sync status from expiresAt
        const now = new Date();
        const formattedSubscriptions = subscriptions.map(sub => {
            const expires = new Date(sub.expiresAt);
            const isExpired = expires < now;
            const dbStatus = sub.status || 'active';
            const effectiveStatus = isExpired ? 'expired' : dbStatus;
            return {
                ...sub,
                status: effectiveStatus,
                selectedPageIds: safeParseIds(sub.selectedPageIds),
                selectedUserIds: safeParseIds(sub.selectedUserIds),
                selectedAdAccountIds: safeParseIds((sub as any).selectedAdAccountIds),
            };
        });

        return NextResponse.json({ subscriptions: formattedSubscriptions });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }
}

// POST - Create new subscription
export async function POST(req: NextRequest) {
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

        const body = await req.json();
        // Support both API keys and frontend keys (pages/users/months/adAccounts)
        const {
            name = 'Centxo',
            type = 'custom',
            pagesLimit: bodyPagesLimit,
            usersLimit: bodyUsersLimit,
            adAccountsLimit: bodyAdAccountsLimit,
            amount = 0,
            durationMonths: bodyDurationMonths,
            autoRenew = false,
            selectedPageIds = [],
            selectedUserIds = [],
            selectedAdAccountIds = [],
            pages,
            users,
            adAccounts,
            months
        } = body;
        const pagesLimit = bodyPagesLimit ?? pages ?? 5;
        const usersLimit = bodyUsersLimit ?? users ?? 5;
        const adAccountsLimit = bodyAdAccountsLimit ?? adAccounts ?? 0;
        const durationMonths = bodyDurationMonths ?? months ?? 1;

        // Generate unique package ID
        let packageId = generatePackageId();
        let attempts = 0;
        while (attempts < 10) {
            const existing = await prisma.subscription.findUnique({
                where: { packageId },
            });
            if (!existing) break;
            packageId = generatePackageId();
            attempts++;
        }

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

        const subscription = await prisma.subscription.create({
            data: {
                packageId,
                userId: user.id,
                name,
                type,
                pagesLimit,
                usersLimit,
                adAccountsLimit: adAccountsLimit ?? 0,
                amount,
                durationMonths,
                autoRenew,
                expiresAt,
                selectedPageIds: JSON.stringify(selectedPageIds),
                selectedUserIds: JSON.stringify(selectedUserIds),
                selectedAdAccountIds: JSON.stringify(selectedAdAccountIds),
            },
        });

        return NextResponse.json({
            success: true,
            subscription: {
                ...subscription,
                selectedPageIds,
                selectedUserIds,
                selectedAdAccountIds,
            }
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }
}
