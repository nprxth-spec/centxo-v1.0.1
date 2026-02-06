import { NextRequest, NextResponse } from 'next/server';
import { stripe, getPlanByPriceId, getPlanByName } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : 'Invalid signature'}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!session.metadata?.userId || typeof session.subscription !== 'string') break;

        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const item = sub.items.data[0];
        if (!item) break;

        // Prefer metadata.planName (from checkout) over price ID lookup
        const planFromMeta = session.metadata.planName
          ? getPlanByName(session.metadata.planName)
          : null;
        const plan = planFromMeta?.name && planFromMeta.name !== 'FREE'
          ? planFromMeta
          : getPlanByPriceId(item.price.id);
        await prisma.user.update({
          where: { id: session.metadata.userId },
          data: {
            subscriptionId: session.subscription,
            stripeCustomerId: (session.customer as string) || undefined,
            plan: plan.name,
            subscriptionStatus: 'active',
            currentPeriodEnd: new Date(item.current_period_end * 1000),
          },
        });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: sub.customer as string },
        });
        if (!user) break;

        const item = sub.items.data[0];
        const isCanceled = sub.status === 'canceled' || sub.status === 'unpaid';

        if (item) {
          const plan = getPlanByPriceId(item.price.id);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: sub.status,
              plan: isCanceled ? 'FREE' : plan.name,
              currentPeriodEnd: new Date(item.current_period_end * 1000),
            },
          });
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: sub.status,
              plan: 'FREE',
              subscriptionId: null,
            },
          });
        }
        break;
      }

      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
