import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        if (!stripe) {
            return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
        }

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { planName, paymentMethodId } = body;

        const plan = PLANS.find((p) => p.name === planName);
        if (!plan || !plan.priceId) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user || !user.stripeCustomerId) {
            return NextResponse.json({ error: 'No customer found' }, { status: 400 });
        }

        // Attach payment method to customer if not already attached
        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: user.stripeCustomerId,
            });
        } catch (error: any) {
            // Check if already attached to this customer, harmless
            if (error.code !== 'resource_already_exists') {
                // Try to proceed, maybe it was attached already
            }
        }

        // Set as default payment method for customer
        await stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: user.stripeCustomerId,
            items: [{ price: plan.priceId }],
            default_payment_method: paymentMethodId,
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        });

        if (subscription.status === 'active' || subscription.status === 'trialing') {
            return NextResponse.json({
                subscriptionId: subscription.id,
                status: subscription.status
            });
        }

        // If payment requires action (3DS)
        const invoice = subscription.latest_invoice as any; // Cast to any to avoid type issues with older Stripe definitions
        const paymentIntent = invoice?.payment_intent;

        if (paymentIntent && typeof paymentIntent !== 'string' && (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation')) {
            return NextResponse.json({
                subscriptionId: subscription.id,
                clientSecret: paymentIntent.client_secret,
                status: 'requires_action'
            });
        }

        if (subscription.status === 'incomplete') {
            const invoice = subscription.latest_invoice as any;
            const paymentIntent = invoice?.payment_intent;
            let errorMsg = 'Payment failed. Please try another card.';

            if (paymentIntent && typeof paymentIntent !== 'string' && paymentIntent.last_payment_error?.message) {
                errorMsg = paymentIntent.last_payment_error.message;
            }

            return NextResponse.json({
                subscriptionId: subscription.id,
                status: 'incomplete',
                error: errorMsg
            }, { status: 400 });
        }

        return NextResponse.json({
            subscriptionId: subscription.id,
            status: subscription.status
        });

    } catch (error: any) {
        console.error('Subscription error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create subscription' }, { status: 500 });
    }
}
