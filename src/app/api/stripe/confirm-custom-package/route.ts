import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function generatePackageId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * After user pays for Custom Plan, create subscription from Stripe Checkout session.
 * Idempotent: if subscription already created for this session_id, returns it.
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

    const body = await request.json();
    const sessionId = body.session_id;
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Idempotency: already created for this payment
    const existing = await prisma.subscription.findUnique({
      where: { stripeCheckoutSessionId: sessionId },
    });
    if (existing) {
      return NextResponse.json({ success: true, subscription: existing });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }
    const meta = checkoutSession.metadata || {};
    if (meta.userId !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
    }

    const pagesLimit = Math.max(1, parseInt(meta.pagesLimit || '5', 10));
    const usersLimit = Math.max(1, parseInt(meta.usersLimit || '5', 10));
    const adAccountsLimit = Math.max(0, parseInt(meta.adAccountsLimit || '0', 10));
    const durationMonths = Math.max(1, parseInt(meta.durationMonths || '1', 10));
    const amount = Math.max(0, parseInt(meta.amount || '0', 10));
    const packageName = meta.packageName || 'Custom Plan';
    const packageType = meta.type || 'custom';

    let packageId = generatePackageId();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.subscription.findUnique({ where: { packageId } });
      if (!exists) break;
      packageId = generatePackageId();
      attempts++;
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

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
        autoRenew: false,
        expiresAt,
        selectedPageIds: JSON.stringify([]),
        selectedUserIds: JSON.stringify([]),
        selectedAdAccountIds: JSON.stringify([]),
        stripeCheckoutSessionId: sessionId,
      },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        selectedPageIds: [],
        selectedUserIds: [],
        selectedAdAccountIds: [],
      },
    });
  } catch (error) {
    console.error('Confirm custom package error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Confirm failed' },
      { status: 500 }
    );
  }
}
