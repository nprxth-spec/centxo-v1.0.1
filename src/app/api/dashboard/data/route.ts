import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';

/**
 * Combined Dashboard API - fetches stats + campaigns in one round-trip.
 * Reduces client-side API calls from 2 to 1.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const rateLimitResponse = await rateLimit(request, RateLimitPresets.standard, session?.user?.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const adAccountIdsParam = searchParams.get('adAccountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!adAccountIdsParam) {
      return NextResponse.json({ error: 'Ad account ID required' }, { status: 400 });
    }

    const adAccountIds = adAccountIdsParam.split(',').filter(Boolean);
    const base =
      process.env.NEXTAUTH_URL ||
      (typeof process.env.VERCEL_URL === 'string' ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:3000';

    const dateParams =
      startDate && endDate
        ? `&startDate=${startDate}&endDate=${endDate}`
        : '';
    const statsUrl = `${base}/api/dashboard/stats?adAccountId=${adAccountIdsParam}${dateParams}`;
    const campaignsUrl = `${base}/api/campaigns?adAccountId=${encodeURIComponent(adAccountIdsParam)}&mode=full&limit=10${
      startDate && endDate ? `&dateFrom=${startDate}&dateTo=${endDate}` : ''
    }`;

    const cookie = request.headers.get('cookie') || '';

    const [statsRes, campaignsRes] = await Promise.all([
      fetch(statsUrl, { headers: { cookie }, cache: 'no-store' }),
      fetch(campaignsUrl, { headers: { cookie }, cache: 'no-store' }),
    ]);

    let stats: Record<string, unknown> = {};
    let campaigns: unknown[] = [];
    let error: string | null = null;

    if (statsRes.ok) {
      stats = await statsRes.json();
    } else {
      const errData = await statsRes.json().catch(() => ({}));
      error = errData.error || `Stats failed (${statsRes.status})`;
    }

    if (campaignsRes.ok) {
      const data = await campaignsRes.json();
      campaigns = data.campaigns || [];
    } else if (!error) {
      const errData = await campaignsRes.json().catch(() => ({}));
      error = errData.error || `Campaigns failed (${campaignsRes.status})`;
    }

    return NextResponse.json({
      stats,
      campaigns,
      error: error || undefined,
    });
  } catch (err) {
    console.error('Error in /api/dashboard/data:', err);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
