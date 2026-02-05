import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlanLimits } from '@/lib/plan-limits';

/**
 * GET /api/user/plan-limits
 * Returns plan limits for the current user (ad accounts, pages, team members)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });
    const plan = user?.plan || 'FREE';
    const limits = getPlanLimits(plan);

    return NextResponse.json({ plan, limits });
  } catch (error) {
    console.error('Error fetching plan limits:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
