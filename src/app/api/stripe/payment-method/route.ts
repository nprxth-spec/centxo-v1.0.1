import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
});

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { paymentMethodId } = await req.json();
        if (!paymentMethodId) {
            return NextResponse.json({ error: 'Payment method ID required' }, { status: 400 });
        }

        // Get user's Stripe customer ID
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { stripeCustomerId: true },
        });

        if (!user?.stripeCustomerId) {
            return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 });
        }

        // Verify the payment method belongs to this customer
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (paymentMethod.customer !== user.stripeCustomerId) {
            return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
        }

        // Check if this is the only payment method - prevent deletion if customer has active subscription
        const customer = await stripe.customers.retrieve(user.stripeCustomerId) as Stripe.Customer;
        const subscriptions = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: 'active',
        });

        if (subscriptions.data.length > 0) {
            // Check how many payment methods exist
            const paymentMethods = await stripe.paymentMethods.list({
                customer: user.stripeCustomerId,
                type: 'card',
            });

            if (paymentMethods.data.length <= 1) {
                return NextResponse.json({
                    error: 'Cannot delete the only payment method while you have an active subscription. Add another payment method first.'
                }, { status: 400 });
            }
        }

        // Detach the payment method
        await stripe.paymentMethods.detach(paymentMethodId);

        return NextResponse.json({ success: true, message: 'Payment method deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting payment method:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete payment method' }, { status: 500 });
    }
}
