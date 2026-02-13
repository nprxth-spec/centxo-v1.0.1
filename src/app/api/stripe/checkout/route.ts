import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { stripe, PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const getAppUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planName } = await request.json();
    const plan = PLANS.find((p) => p.name === planName);

    if (!plan || planName === 'FREE') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!plan.priceId || !plan.priceId.startsWith('price_')) {
      return NextResponse.json(
        { error: 'STRIPE_PRICE_ID_PLUS or STRIPE_PRICE_ID_PRO not configured. Add Price IDs from Stripe Dashboard.' },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        billing_address_collection: 'auto',
        line_items: [{ price: plan.priceId, quantity: 1 }],
        metadata: { userId: user.id, planName: plan.name },
        success_url: `${getAppUrl()}/settings?tab=subscription?success=true`,
        cancel_url: `${getAppUrl()}/settings?tab=subscription?canceled=true`,
      });
    } catch (err: any) {
      // Handle currency mismatch error by creating a new customer
      if (err.message && err.message.includes('currency')) {
        console.log('Currency mismatch detected. Creating new customer...');

        // Create new customer
        const customer = await stripe.customers.create({
          email: user.email!,
          name: user.name || undefined,
          metadata: { userId: user.id },
        });

        customerId = customer.id;

        // Update user with new customer ID
        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerId },
        });

        // Retry session creation with new customer
        checkoutSession = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          billing_address_collection: 'auto',
          line_items: [{ price: plan.priceId, quantity: 1 }],
          metadata: { userId: user.id, planName: plan.name },
          success_url: `${getAppUrl()}/settings?tab=subscription?success=true`,
          cancel_url: `${getAppUrl()}/settings?tab=subscription?canceled=true`,
        });
      } else {
        throw err;
      }
    }

    return NextResponse.json({ url: checkoutSession.url });

  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
