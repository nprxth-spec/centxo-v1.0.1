
import { NextRequest, NextResponse } from 'next/server';
import { stripe, getPlanByPriceId } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get('Stripe-Signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: any) {
        return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const subscription = event.data.object as Stripe.Subscription;

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                // Handle successful subscription creation
                if (session.metadata?.userId) {
                    const subscriptionId = session.subscription as string;
                    // Retrieve subscription details to get end date
                    const sub = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;

                    // Get plan name from priceId
                    const priceId = sub.items.data[0].price.id;
                    const plan = getPlanByPriceId(priceId);

                    await prisma.user.update({
                        where: { id: session.metadata.userId },
                        data: {
                            subscriptionId: subscriptionId,
                            stripeCustomerId: session.customer as string,
                            plan: plan.name,
                            subscriptionStatus: 'active',
                            currentPeriodEnd: new Date(sub.items.data[0].current_period_end * 1000),
                        },
                    });
                }
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                // Handle subscription updates/cancellations
                const sub = event.data.object as Stripe.Subscription;

                // Find user by customer ID
                const user = await prisma.user.findUnique({
                    where: { stripeCustomerId: sub.customer as string },
                });

                if (user) {
                    const priceId = sub.items.data[0].price.id;
                    const plan = getPlanByPriceId(priceId);
                    const isCanceled = sub.status === 'canceled';

                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            subscriptionStatus: sub.status,
                            plan: isCanceled ? 'FREE' : plan.name, // Revert to FREE if canceled
                            currentPeriodEnd: new Date(sub.items.data[0].current_period_end * 1000),
                        },
                    });
                }
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Webhook Handler Error:', error);
        return NextResponse.json({ error: 'Webhook Handler Failed' }, { status: 500 });
    }
}
