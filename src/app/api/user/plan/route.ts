import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe, getPlanByPriceId } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, plan: true, stripeCustomerId: true, subscriptionId: true, createdAt: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { getEffectiveHostId } = await import('@/lib/team-utils');
        const hostId = await getEffectiveHostId(user.id, session.user.email);

        const targetUser = hostId === user.id ? user : await prisma.user.findUnique({
            where: { id: hostId },
            select: { id: true, plan: true, stripeCustomerId: true, subscriptionId: true, createdAt: true }
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'Host not found' }, { status: 404 });
        }

        let plan = targetUser.plan || 'FREE';
        const createdAt = targetUser.createdAt;

        // Sync plan from Stripe if user has subscription (fallback when webhook fails/delays)
        if (stripe && user?.subscriptionId) {
            try {
                const sub = await stripe.subscriptions.retrieve(user.subscriptionId);
                const isActive = ['active', 'trialing', 'past_due'].includes(sub.status);
                if (isActive && sub.items.data[0]) {
                    const planFromStripe = getPlanByPriceId(sub.items.data[0].price.id);
                    const newPlan = planFromStripe.name !== 'FREE' ? planFromStripe.name : plan;
                    if (newPlan !== plan) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                plan: newPlan,
                                subscriptionStatus: sub.status,
                                currentPeriodEnd: sub.items.data[0].current_period_end
                                    ? new Date(sub.items.data[0].current_period_end * 1000)
                                    : undefined,
                            },
                        });
                        plan = newPlan;
                    }
                } else if (!isActive && plan !== 'FREE') {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { plan: 'FREE', subscriptionStatus: sub.status },
                    });
                    plan = 'FREE';
                }
            } catch (e) {
                // Subscription may be deleted; ignore
            }
        }

        // Fallback: user paid but subscriptionId not in DB yet - check by customer
        if (stripe && user?.stripeCustomerId && plan === 'FREE') {
            try {
                const subs = await stripe.subscriptions.list({
                    customer: user.stripeCustomerId,
                    status: 'active',
                    limit: 1,
                });
                const activeSub = subs.data[0];
                if (activeSub?.items.data[0]) {
                    const planFromStripe = getPlanByPriceId(activeSub.items.data[0].price.id);
                    if (planFromStripe.name !== 'FREE') {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                plan: planFromStripe.name,
                                subscriptionId: activeSub.id,
                                subscriptionStatus: activeSub.status,
                                currentPeriodEnd: activeSub.items.data[0].current_period_end
                                    ? new Date(activeSub.items.data[0].current_period_end * 1000)
                                    : undefined,
                            },
                        });
                        plan = planFromStripe.name;
                    }
                }
            } catch (e) {
                // Ignore
            }
        }

        // Determine team role of the CURRENT user
        const membership = await prisma.teamMember.findFirst({
            where: {
                memberEmail: session.user.email,
                memberType: 'email'
            },
            select: { role: true }
        });

        const teamRole = membership?.role || 'OWNER';

        return NextResponse.json({ plan, createdAt, teamRole });
    } catch (error) {
        console.error('Error fetching user plan:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
