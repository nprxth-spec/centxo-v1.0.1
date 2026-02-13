import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { getCached, setCache, generateCacheKey, CacheTTL } from '@/lib/cache/redis';
import { getApiAccountCap, getDynamicChunkSize, getDynamicChunkDelayMs } from '@/lib/plan-limits';
import { MAX_ACCOUNTS_PER_REQUEST } from '@/lib/meta-quota-config';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Rate limiting (User ID priority)
    const rateLimitResponse = await rateLimit(request, RateLimitPresets.standard, session?.user?.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get params
    const { searchParams } = new URL(request.url);
    const adAccountIdsParam = searchParams.get('adAccountId');
    const startDate = searchParams.get('startDate'); // YYYY-MM-DD
    const endDate = searchParams.get('endDate');     // YYYY-MM-DD

    if (!adAccountIdsParam) {
      return NextResponse.json({ error: 'Ad account ID required' }, { status: 400 });
    }

    let adAccountIds = adAccountIdsParam.split(',').filter(Boolean);

    // Fetch user with plan and tokens
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        teamMembers: true,
        metaAccount: {
          select: { accessToken: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cap accounts by plan and by per-request limit (supports 500+ users, 10k+ accounts)
    const plan = (user as any).plan || 'FREE';
    const planCap = getApiAccountCap(plan);
    const requestCap = Math.min(planCap, MAX_ACCOUNTS_PER_REQUEST);
    const requestedCount = adAccountIds.length;
    if (adAccountIds.length > requestCap) {
      adAccountIds = adAccountIds.slice(0, requestCap);
    }
    const accountsTruncated = requestedCount > adAccountIds.length;

    // Redis cache for insights (reduces Meta API calls)
    const cacheKey = generateCacheKey('dashboard:stats', session.user.id, adAccountIds.sort().join(','), startDate || '', endDate || '');
    const cached = await getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Meta Account Integrity Compliance: Use ONLY user's own tokens
    const { getUserTokensOnly } = await import('@/lib/facebook/user-tokens-only');
    const tokens = await getUserTokensOnly(session);

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected' },
        { status: 400 }
      );
    }

    // Initialize aggregated stats for Current Period
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLinkClicks = 0;
    let totalMessages = 0;
    let totalRevenue = 0;
    let totalActiveCampaigns = 0;

    // Funnel Metrics
    let totalViewContent = 0;
    let totalAddToCart = 0;
    let totalPurchases = 0;

    // Initialize aggregated stats for Previous Period
    let prevTotalSpend = 0;
    let prevTotalImpressions = 0;
    let prevTotalClicks = 0;
    let prevTotalLinkClicks = 0;
    let prevTotalMessages = 0;
    let prevTotalRevenue = 0;
    let prevTotalPurchases = 0;

    // Map for daily aggregation: "YYYY-MM-DD" -> { spend, revenue, messages, ... }
    const dailyMap = new Map<string, {
      spend: number;
      revenue: number;
      messages: number;
      impressions: number;
      clicks: number;
      linkClicks: number;
      purchases: number;
    }>();

    // Date Calculation Logic
    let currentStart: Date;
    let currentEnd: Date;

    if (startDate && endDate) {
      currentStart = new Date(startDate);
      currentEnd = new Date(endDate);
    } else {
      // Default: Last 30 days
      currentEnd = new Date();
      currentStart = new Date();
      currentStart.setDate(currentEnd.getDate() - 29); // 30 days total
    }

    // Calculate Previous Period
    const duration = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime() - 86400000); // 1 day before current start
    const prevStart = new Date(prevEnd.getTime() - duration);

    // Format for API (YYYY-MM-DD)
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const apiStartDate = formatDate(prevStart); // Fetch from start of PREVIOUS period
    const apiEndDate = formatDate(currentEnd);  // To end of CURRENT period
    const currentStartStr = formatDate(currentStart);

    // Construct common query params with EXTENDED range
    // Requesting expanded fields: impressions, clicks, inline_link_clicks
    const timeRangeParams = `&time_range={'since':'${apiStartDate}','until':'${apiEndDate}'}`;

    // Chunked fetch to avoid burst rate limits (dynamic chunk size + delay)
    const CHUNK_SIZE = getDynamicChunkSize(adAccountIds.length);
    const CHUNK_DELAY_MS = getDynamicChunkDelayMs(adAccountIds.length);

    type DayRow = { date: string; spend: number; revenue: number; messages: number; impressions: number; clicks: number; linkClicks: number; purchases: number; viewContent: number; addToCart: number; isCurrent: boolean };
    const processAccount = async (adAccountId: string): Promise<{ days: DayRow[]; activeCampaigns: number } | null> => {
      try {
        const token = await getValidTokenForAdAccount(adAccountId, tokens);
        if (!token) return null;
        const insightsUrl = `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=spend,impressions,clicks,inline_link_clicks,actions,action_values,date_start${timeRangeParams}&time_increment=1&access_token=${token}`;
        const campaignsUrl = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=status&access_token=${token}`;
        const [insightsResponse, campaignsResponse] = await Promise.all([fetch(insightsUrl), fetch(campaignsUrl)]);

        const days: DayRow[] = [];
        let activeCampaigns = 0;

        if (insightsResponse.ok) {
          const data = await insightsResponse.json();
          (data.data || []).forEach((day: any) => {
            const date = day.date_start;
            const spend = parseFloat(day.spend || '0');
            const impressions = parseInt(day.impressions || '0');
            const clicks = parseInt(day.clicks || '0');
            const linkClicks = parseInt(day.inline_link_clicks || '0');
            let messages = 0, viewContent = 0, addToCart = 0, purchases = 0, revenue = 0;
            if (day.actions) {
              day.actions.forEach((a: any) => {
                if (a.action_type === 'onsite_conversion.messaging_conversation_started_7d') messages += parseInt(a.value);
                if (a.action_type === 'offsite_conversion.fb_pixel_view_content') viewContent += parseInt(a.value);
                if (a.action_type === 'offsite_conversion.fb_pixel_add_to_cart') addToCart += parseInt(a.value);
                if (a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase') purchases += parseInt(a.value);
              });
            }
            if (day.action_values) {
              const p = day.action_values.find((a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
              if (p) revenue = parseFloat(p.value);
            }
            days.push({ date, spend, revenue, messages, impressions, clicks, linkClicks, purchases, viewContent, addToCart, isCurrent: date >= currentStartStr });
          });
        }
        if (campaignsResponse.ok) {
          const campaignsData = await campaignsResponse.json();
          activeCampaigns = campaignsData.data?.filter((c: any) => c.status === 'ACTIVE').length || 0;
        }
        return { days, activeCampaigns };
      } catch (err) {
        console.error(`Error fetching stats for account:`, err);
        return null;
      }
    };

    for (let i = 0; i < adAccountIds.length; i += CHUNK_SIZE) {
      const chunk = adAccountIds.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(chunk.map(processAccount));
      for (const r of results) {
        if (!r) continue;
        totalActiveCampaigns += r.activeCampaigns;
        for (const d of r.days) {
          if (d.isCurrent) {
            totalSpend += d.spend;
            totalImpressions += d.impressions;
            totalClicks += d.clicks;
            totalLinkClicks += d.linkClicks;
            totalMessages += d.messages;
            totalViewContent += d.viewContent;
            totalAddToCart += d.addToCart;
            totalPurchases += d.purchases;
            totalRevenue += d.revenue;
            const existing = dailyMap.get(d.date) || { spend: 0, revenue: 0, messages: 0, impressions: 0, clicks: 0, linkClicks: 0, purchases: 0 };
            dailyMap.set(d.date, {
              spend: existing.spend + d.spend,
              revenue: existing.revenue + d.revenue,
              messages: existing.messages + d.messages,
              impressions: existing.impressions + d.impressions,
              clicks: existing.clicks + d.clicks,
              linkClicks: existing.linkClicks + d.linkClicks,
              purchases: existing.purchases + d.purchases
            });
          } else {
            prevTotalSpend += d.spend;
            prevTotalImpressions += d.impressions;
            prevTotalClicks += d.clicks;
            prevTotalLinkClicks += d.linkClicks;
            prevTotalMessages += d.messages;
            prevTotalPurchases += d.purchases;
            prevTotalRevenue += d.revenue;
          }
        }
      }
      if (i + CHUNK_SIZE < adAccountIds.length) {
        await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
      }
    }

    // --- Computed Metrics (Current) ---
    const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgCostPerMessage = totalMessages > 0 ? totalSpend / totalMessages : 0;
    const avgCpc = totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0;
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const avgCtr = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
    const avgCpp = totalPurchases > 0 ? totalSpend / totalPurchases : 0; // Cost per Purchase

    // --- Computed Metrics (Previous) ---
    const prevTotalRoas = prevTotalSpend > 0 ? prevTotalRevenue / prevTotalSpend : 0;
    const prevAvgCostPerMessage = prevTotalMessages > 0 ? prevTotalSpend / prevTotalMessages : 0;
    const prevAvgCpc = prevTotalLinkClicks > 0 ? prevTotalSpend / prevTotalLinkClicks : 0;
    const prevAvgCpm = prevTotalImpressions > 0 ? (prevTotalSpend / prevTotalImpressions) * 1000 : 0;
    const prevAvgCtr = prevTotalImpressions > 0 ? (prevTotalLinkClicks / prevTotalImpressions) * 100 : 0;

    // Calculate Percentage Changes vs Previous Period
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const changes = {
      spend: calculateChange(totalSpend, prevTotalSpend),
      revenue: calculateChange(totalRevenue, prevTotalRevenue),
      messages: calculateChange(totalMessages, prevTotalMessages),
      roas: calculateChange(totalRoas, prevTotalRoas),
      cpc: calculateChange(avgCpc, prevAvgCpc),
      cpm: calculateChange(avgCpm, prevAvgCpm),
      ctr: calculateChange(avgCtr, prevAvgCtr),
      purchases: calculateChange(totalPurchases, prevTotalPurchases)
    };

    // Convert dailyMap to sorted array (Current Period Only) WITH zero-filling
    const chartData = [];
    const loopDate = new Date(currentStart);
    const lastDate = new Date(currentEnd);

    while (loopDate <= lastDate) {
      const dateStr = formatDate(loopDate);
      const stats = dailyMap.get(dateStr) || {
        spend: 0, revenue: 0, messages: 0,
        impressions: 0, clicks: 0, linkClicks: 0, purchases: 0
      };

      chartData.push({
        date: dateStr,
        spend: stats.spend,
        revenue: stats.revenue,
        messages: stats.messages,
        impressions: stats.impressions,
        clicks: stats.clicks,
        linkClicks: stats.linkClicks,
        purchases: stats.purchases,
        cpc: stats.linkClicks > 0 ? stats.spend / stats.linkClicks : 0,
        ctr: stats.impressions > 0 ? (stats.linkClicks / stats.impressions) * 100 : 0,
        cpm: stats.impressions > 0 ? (stats.spend / stats.impressions) * 1000 : 0,
        cpp: stats.purchases > 0 ? stats.spend / stats.purchases : 0,
        cpr: stats.messages > 0 ? stats.spend / stats.messages : 0,
        roas: stats.spend > 0 ? stats.revenue / stats.spend : 0
      });

      loopDate.setDate(loopDate.getDate() + 1);
    }

    // Consolidated Extended Stats
    const extendedStats = {
      impressions: totalImpressions,
      clicks: totalClicks,
      linkClicks: totalLinkClicks,
      cpc: avgCpc,
      cpm: avgCpm,
      ctr: avgCtr,
      cpp: avgCpp,
      frequency: 0, // Not available in aggregate yet
      funnel: {
        viewContent: totalViewContent,
        addToCart: totalAddToCart,
        purchase: totalPurchases
      }
    };

    const payload = {
      totalSpend,
      totalMessages,
      totalRevenue,
      totalRoas,
      avgCostPerMessage,
      activeCampaigns: totalActiveCampaigns,
      chartData,
      changes,
      extendedStats,
      accountsIncluded: adAccountIds.length,
      accountsTruncated: accountsTruncated ? requestedCount : undefined,
    };

    await setCache(cacheKey, payload, CacheTTL.DASHBOARD_STATS);
    return NextResponse.json(payload);

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
