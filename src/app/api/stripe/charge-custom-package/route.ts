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
 * Charge customer using existing payment method for Custom Plan (one-time payment).
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

    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 });
    }

    const body = await request.json();
    const pagesLimit = Number(body.pages) || 5;
    const usersLimit = Number(body.users) || 5;
    const adAccountsLimit = Number(body.adAccounts) || 0;
    const durationMonths = Number(body.months) || 1;
    const amount = Math.round(Number(body.amount) || 0);
    const paymentMethodId = body.paymentMethodId;
    const packageName = body.packageName || 'Custom Plan';
    const packageType = body.packageType || 'custom';

    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID required' }, { status: 400 });
    }

    // Verify payment method belongs to customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== user.stripeCustomerId) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // THB -> satang
      currency: 'thb',
      customer: user.stripeCustomerId,
      payment_method: paymentMethodId,
      confirmation_method: 'automatic',
      confirm: true,
      return_url: `${getAppUrl()}/settings?tab=subscription`,
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
    });

    // Check if payment requires action (3D Secure)
    if (paymentIntent.status === 'requires_action' && paymentIntent.next_action) {
      return NextResponse.json({
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    }

    // Check if payment succeeded
    if (paymentIntent.status === 'succeeded') {
      // Generate unique package ID
      const generatePackageId = () => {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

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

      // Create subscription in database
      const subscription = await prisma.subscription.create({
        data: {
          packageId,
          userId: user.id,
          name: packageName,
          type: packageType,
          pagesLimit,
          usersLimit,
          adAccountsLimit,
          amount,
          durationMonths,
          status: 'active',
          autoRenew: false,
          startDate: new Date(),
          expiresAt,
          stripeCheckoutSessionId: paymentIntent.id, // Store payment intent ID for reference
        },
      });

      return NextResponse.json({
        success: true,
        subscriptionId: subscription.id,
        packageId: subscription.packageId,
      });
    }

    // Payment failed
    return NextResponse.json(
      { error: paymentIntent.last_payment_error?.message || 'Payment failed' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Stripe charge-custom-package error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Charge failed' },
      { status: 500 }
    );
  }
}
