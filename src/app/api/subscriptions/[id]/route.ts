import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Resolve subscription by id (cuid) or packageId
async function findSubscription(id: string, userId: string) {
    // Try by packageId first (6-char format)
    if (id.length <= 10 && /^[A-Z0-9]+$/i.test(id)) {
        const byPackage = await prisma.subscription.findFirst({
            where: { packageId: id, userId },
        });
        if (byPackage) return byPackage;
    }
    return prisma.subscription.findFirst({
        where: { id, userId },
    });
}

// GET - Get single subscription by packageId or id (supports team members)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { getEffectiveHostId } = await import('@/lib/team-utils');
        const hostId = await getEffectiveHostId(user.id, session.user.email);

        const { id } = await params;
        const subscription = await findSubscription(id, hostId);

        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        const now = new Date();
        const expires = new Date(subscription.expiresAt);
        const isExpired = expires < now;
        const daysRemaining = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const expiryText = isExpired
            ? expires.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            : daysRemaining > 30 ? `เหลืออีก ${Math.floor(daysRemaining / 30)} เดือน` : `เหลืออีก ${daysRemaining} วัน`;

        return NextResponse.json({
            subscription: {
                ...subscription,
                id: subscription.packageId,
                selectedPageIds: subscription.selectedPageIds ? JSON.parse(subscription.selectedPageIds) : [],
                selectedUserIds: subscription.selectedUserIds ? JSON.parse(subscription.selectedUserIds) : [],
                selectedAdAccountIds: (subscription as any).selectedAdAccountIds ? JSON.parse((subscription as any).selectedAdAccountIds) : [],
                maxPages: subscription.pagesLimit,
                maxUsers: subscription.usersLimit,
                status: isExpired ? 'expired' : (subscription.status || 'active'),
                expiry: expiryText,
            },
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }
}

// PATCH - Update subscription (selectedPageIds, selectedUserIds, autoRenew, name)
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is a member/host and has permission (ADMIN/OWNER)
        const membership = await prisma.teamMember.findFirst({
            where: { memberEmail: session.user.email, memberType: 'email' },
            select: { userId: true, role: true }
        });

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, isTeamHost: true }
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const hostId = membership?.userId || user.id;
        const isOwner = user.id === hostId;
        const isAdmin = membership?.role === 'ADMIN';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { id } = await params;
        const subscription = await findSubscription(id, hostId);

        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        const body = await req.json();
        const { selectedPageIds, selectedUserIds, selectedAdAccountIds, autoRenew, name } = body;

        const updateData: any = {};
        if (Array.isArray(selectedPageIds)) updateData.selectedPageIds = JSON.stringify(selectedPageIds);
        if (Array.isArray(selectedUserIds)) updateData.selectedUserIds = JSON.stringify(selectedUserIds);
        if (Array.isArray(selectedAdAccountIds)) updateData.selectedAdAccountIds = JSON.stringify(selectedAdAccountIds);
        if (typeof autoRenew === 'boolean') updateData.autoRenew = autoRenew;
        if (typeof name === 'string') updateData.name = name;

        const { deleteCachePattern } = await import('@/lib/cache/redis');

        await prisma.subscription.update({
            where: { id: subscription.id },
            data: updateData,
        });

        // Invalidate Redis: team config and related caches for this host
        await Promise.all([
            deleteCachePattern(`team:*:${hostId}*`),
            deleteCachePattern(`team:*:${user.id}*`),
        ]);

        // Invalidate in-memory team config cache (used by /api/team/config) so next request gets fresh data
        const g = globalThis as typeof globalThis & { _teamConfigCache?: Record<string, { data: unknown; timestamp: number }> };
        if (g._teamConfigCache) {
            delete g._teamConfigCache[`config_v15_${hostId}`];
            if (user.id !== hostId) delete g._teamConfigCache[`config_v15_${user.id}`];
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating subscription:', error);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }
}

// DELETE - Delete a subscription by ID
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, isTeamHost: true }
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Only owner can delete subscription
        const membership = await prisma.teamMember.findFirst({
            where: { memberEmail: session.user.email, memberType: 'email' },
            select: { userId: true }
        });

        if (membership) {
            // Team member cannot delete host's subscription
            return NextResponse.json({ error: 'Only team owner can delete subscriptions' }, { status: 403 });
        }

        const { id } = await params;
        const subscription = await findSubscription(id, user.id);

        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        await prisma.subscription.delete({
            where: { id: subscription.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting subscription:', error);
        return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
    }
}
