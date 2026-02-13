import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const getAppUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'http://localhost:3000';

/**
 * Create Stripe Checkout Session for Custom Plan (one-time payment).
 * Amount is in THB; Stripe THB uses satang (unit_amount = amount * 100).
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true, email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const pagesLimit = Number(body.pages) || 5;
    const usersLimit = Number(body.users) || 5;
    const adAccountsLimit = Number(body.adAccounts) || 0;
    const durationMonths = Number(body.months) || 1;
    const amount = Math.round(Number(body.amount) || 0);
    const packageName = body.packageName || 'Custom Plan';
    const packageType = body.packageType || 'custom';
    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
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

    const baseUrl = getAppUrl();
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'thb',
            product_data: {
              name: 'Custom Plan',
              description: `${pagesLimit} pages, ${usersLimit} users, ${adAccountsLimit} ad accounts, ${durationMonths} month(s)`,
            },
            unit_amount: amount * 100, // THB -> satang
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        type: packageType,
        packageName: packageName,
        pagesLimit: String(pagesLimit),
        usersLimit: String(usersLimit),
        adAccountsLimit: String(adAccountsLimit),
        durationMonths: String(durationMonths),
        amount: String(amount),
      },
      success_url: `${baseUrl}/settings?tab=subscription&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings?tab=subscription`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Stripe checkout-custom-package error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
