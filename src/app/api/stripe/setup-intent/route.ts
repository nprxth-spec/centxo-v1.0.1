import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get or create Stripe customer
        let user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { stripeCustomerId: true, email: true, name: true },
        });

        let customerId = user?.stripeCustomerId;

        if (!customerId) {
            // Create a new Stripe customer
            const customer = await stripe.customers.create({
                email: user?.email || undefined,
                name: user?.name || undefined,
                metadata: {
                    userId: session.user.id,
                },
            });

            // Save the customer ID
            await prisma.user.update({
                where: { id: session.user.id },
                data: { stripeCustomerId: customer.id },
            });

            customerId = customer.id;
        }

        // Create a SetupIntent to save the card for future payments
        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
            usage: 'off_session', // Allow using this card for future payments
        });

        return NextResponse.json({
            clientSecret: setupIntent.client_secret,
            customerId: customerId,
        });
    } catch (error: any) {
        console.error('Error creating SetupIntent:', error);
        return NextResponse.json({ error: error.message || 'Failed to create setup intent' }, { status: 500 });
    }
}
