import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { getCached, setCache, generateCacheKey, CacheTTL } from '@/lib/cache/redis';

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

    const adAccountIds = adAccountIdsParam.split(',').filter(Boolean);

    // Redis cache for insights (reduces Meta API calls)
    const cacheKey = generateCacheKey('dashboard:stats', session.user.id, adAccountIdsParam, startDate || '', endDate || '');
    const cached = await getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch user with team members and MetaAccount to get all tokens
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

    // Collect all tokens
    const tokens: TokenInfo[] = [];
    
    // 1. MetaAccount Token (most reliable)
    if ((user as any).metaAccount?.accessToken) {
      tokens.push({ token: (user as any).metaAccount.accessToken, name: 'Main' });
    }
    
    // 2. Session Token (fallback)
    const mainAccessToken = (session as any).accessToken;
    if (mainAccessToken && !tokens.some(t => t.token === mainAccessToken)) {
      tokens.push({ token: mainAccessToken, name: 'Session' });
    }
    
    // 3. Team Members
    if ((user as any).teamMembers) {
      (user as any).teamMembers.forEach((m: any) => {
        if (m.accessToken && !tokens.some(t => t.token === m.accessToken)) {
          tokens.push({ token: m.accessToken, name: m.facebookName || 'Member' });
        }
      });
    }

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

    // Fetch data in chunks
    const CHUNK_SIZE = 5;
    for (let i = 0; i < adAccountIds.length; i += CHUNK_SIZE) {
      const chunk = adAccountIds.slice(i, i + CHUNK_SIZE);

      await Promise.all(chunk.map(async (adAccountId) => {
        try {
          // Use helper to find correct token (uses Redis cache)
          const token = await getValidTokenForAdAccount(adAccountId, tokens);

          if (!token) {
            console.error(`No valid token for account ${adAccountId} stats`);
            return;
          }

          // Fetch insights + campaigns in parallel (reduces latency per account)
          const insightsUrl = `https://graph.facebook.com/v22.0/${adAccountId}/insights?fields=spend,impressions,clicks,inline_link_clicks,actions,action_values,date_start${timeRangeParams}&time_increment=1&access_token=${token}`;
          const campaignsUrl = `https://graph.facebook.com/v22.0/${adAccountId}/campaigns?fields=status&access_token=${token}`;

          const [insightsResponse, campaignsResponse] = await Promise.all([
            fetch(insightsUrl),
            fetch(campaignsUrl),
          ]);

          if (insightsResponse.ok) {
            const data = await insightsResponse.json();
            const days = data.data || [];

            days.forEach((day: any) => {
              const date = day.date_start; // YYYY-MM-DD
              const spend = parseFloat(day.spend || '0');
              const impressions = parseInt(day.impressions || '0');
              const clicks = parseInt(day.clicks || '0');
              const linkClicks = parseInt(day.inline_link_clicks || '0');

              // Parse Actions
              let messages = 0;
              let viewContent = 0;
              let addToCart = 0;
              let purchases = 0;

              if (day.actions) {
                day.actions.forEach((a: any) => {
                  if (a.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
                    messages += parseInt(a.value);
                  }
                  if (a.action_type === 'offsite_conversion.fb_pixel_view_content') {
                    viewContent += parseInt(a.value);
                  }
                  if (a.action_type === 'offsite_conversion.fb_pixel_add_to_cart') {
                    addToCart += parseInt(a.value);
                  }
                  if (a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase') {
                    purchases += parseInt(a.value);
                  }
                });
              }

              // Parse Revenue
              let revenue = 0;
              if (day.action_values) {
                const purchaseValueAction = day.action_values.find((a: any) =>
                  a.action_type === 'purchase' || a.action_type === 'omni_purchase'
                );
                if (purchaseValueAction) {
                  revenue = parseFloat(purchaseValueAction.value);
                }
              }

              // Check if date belongs to Current or Previous period
              if (date >= currentStartStr) {
                // Current Period
                totalSpend += spend;
                totalImpressions += impressions;
                totalClicks += clicks;
                totalLinkClicks += linkClicks;
                totalMessages += messages;
                totalViewContent += viewContent;
                totalAddToCart += addToCart;
                totalPurchases += purchases;
                totalRevenue += revenue;

                // Add to Daily Map (only for Current Period Chart)
                const existing = dailyMap.get(date) || {
                  spend: 0, revenue: 0, messages: 0,
                  impressions: 0, clicks: 0, linkClicks: 0, purchases: 0
                };
                dailyMap.set(date, {
                  spend: existing.spend + spend,
                  revenue: existing.revenue + revenue,
                  messages: existing.messages + messages,
                  impressions: existing.impressions + impressions,
                  clicks: existing.clicks + clicks,
                  linkClicks: existing.linkClicks + linkClicks,
                  purchases: existing.purchases + purchases
                });
              } else {
                // Previous Period
                prevTotalSpend += spend;
                prevTotalImpressions += impressions;
                prevTotalClicks += clicks;
                prevTotalLinkClicks += linkClicks;
                prevTotalMessages += messages;
                prevTotalPurchases += purchases;
                prevTotalRevenue += revenue;
              }
            });
          }

          if (campaignsResponse.ok) {
            const campaignsData = await campaignsResponse.json();
            const activeCount = campaignsData.data?.filter((c: any) => c.status === 'ACTIVE').length || 0;
            totalActiveCampaigns += activeCount;
          }

        } catch (err) {
          console.error(`Error fetching stats for account ${adAccountId}:`, err);
        }
      }));
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
    };

    await setCache(cacheKey, payload, CacheTTL.CAMPAIGNS_INSIGHTS);
    return NextResponse.json(payload);

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
