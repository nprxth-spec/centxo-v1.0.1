import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!stripe) {
      return NextResponse.json({ paymentMethods: [], invoices: [] });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ paymentMethods: [], invoices: [] });
    }

    const [paymentMethodsRes, invoicesRes] = await Promise.all([
      stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
      }),
      stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: 12,
      }),
    ]);

    const paymentMethods = paymentMethodsRes.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || 'card',
      last4: pm.card?.last4 || '****',
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    }));

    const invoices = invoicesRes.data.map((inv) => ({
      id: inv.id,
      number: inv.number || inv.id,
      amountPaid: inv.amount_paid ? inv.amount_paid / 100 : 0,
      currency: inv.currency?.toUpperCase() || 'USD',
      status: inv.status,
      created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      invoicePdf: inv.invoice_pdf || null,
      hostedInvoiceUrl: inv.hosted_invoice_url || null,
    }));

    return NextResponse.json({ paymentMethods, invoices });
  } catch (error) {
    console.error('Billing data error:', error);
    return NextResponse.json(
      { error: 'Failed to load billing data' },
      { status: 500 }
    );
  }
}
