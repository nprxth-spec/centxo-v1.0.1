/**
 * EXAMPLE: Campaigns API with Redis Caching
 * 
 * This is an example implementation showing how to add caching to campaigns API.
 * Copy this pattern to other API routes (adsets, ads, etc.)
 * 
 * PERFORMANCE IMPROVEMENT:
 * - Without cache: 100 API calls per page load
 * - With cache (15min TTL): 100 API calls per 15 minutes (99% reduction for repeat visits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { withCache, generateCacheKey, CacheTTL, deleteCache } from '@/lib/cache/redis';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request, RateLimitPresets.standard);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const adAccountIdsParam = searchParams.get('adAccountId');
    const forceRefresh = searchParams.get('refresh') === 'true'; // Optional: force cache bypass

    if (!adAccountIdsParam) {
      return NextResponse.json({ error: 'Ad account ID required' }, { status: 400 });
    }

    const adAccountIds = adAccountIdsParam.split(',').filter(Boolean);
    const accessToken = (session as any).accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Facebook not connected', campaigns: [] },
        { status: 400 }
      );
    }

    // Generate cache key based on user and accounts
    const cacheKey = generateCacheKey(
      'meta:campaigns',
      session.user.id!,
      adAccountIds.sort().join(',')
    );

    // If force refresh, clear cache first
    if (forceRefresh) {
      await deleteCache(cacheKey);
    }

    // Try to get from cache or fetch fresh data
    const campaigns = await withCache(
      cacheKey,
      CacheTTL.CAMPAIGNS_INSIGHTS, // 15 minutes cache
      async () => {
        // This function only runs on cache miss
        console.log('[API] Fetching fresh campaigns from Meta API');
        return await fetchCampaignsFromMeta(adAccountIds, accessToken);
      }
    );

    return NextResponse.json({
      campaigns,
      count: campaigns.length,
      cached: true, // You can track if this was served from cache
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in GET /api/campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Fetch campaigns from Meta API (original logic)
 */
async function fetchCampaignsFromMeta(adAccountIds: string[], accessToken: string) {
  const allCampaigns: any[] = [];
  const CHUNK_SIZE = 3;

  for (let i = 0; i < adAccountIds.length; i += CHUNK_SIZE) {
    const chunk = adAccountIds.slice(i, i + CHUNK_SIZE);

    await Promise.all(chunk.map(async (adAccountId) => {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,created_time,insights.date_preset(last_30d){spend,actions,cost_per_action_type,reach,impressions,clicks}&access_token=${accessToken}`
        );

        if (response.ok) {
          const data = await response.json();
          const campaigns = data.data || [];

          const formatted = campaigns.map((campaign: any) => {
            const insights = campaign.insights?.data?.[0];
            const messageAction = insights?.actions?.find((a: any) =>
              a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
            );
            const messages = parseInt(messageAction?.value || '0');
            const spend = parseFloat(insights?.spend || '0');
            
            const postEngagementAction = insights?.actions?.find((a: any) =>
              a.action_type === 'post_engagement'
            );
            const postEngagements = parseInt(postEngagementAction?.value || '0');
            
            const messagingContactsAction = insights?.actions?.find((a: any) =>
              a.action_type === 'onsite_conversion.messaging_first_reply'
            );
            const messagingContacts = parseInt(messagingContactsAction?.value || '0');

            const reach = parseInt(insights?.reach || '0');
            const impressions = parseInt(insights?.impressions || '0');
            const clicks = parseInt(insights?.clicks || '0');

            const costPerMessage = messages > 0 ? spend / messages : 0;
            const costPerResult = messages > 0 ? spend / messages : 0;

            return {
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              objective: campaign.objective,
              dailyBudget: parseFloat(campaign.daily_budget || '0') / 100,
              createdAt: campaign.created_time,
              metrics: {
                spend: spend,
                messages: messages,
                costPerMessage: costPerMessage,
                results: messages,
                costPerResult: costPerResult,
                budget: parseFloat(campaign.daily_budget || '0') / 100,
                reach: reach,
                impressions: impressions,
                postEngagements: postEngagements,
                clicks: clicks,
                messagingContacts: messagingContacts,
                amountSpent: spend,
              },
              adAccountId: adAccountId
            };
          });

          allCampaigns.push(...formatted);
        }
      } catch (err) {
        console.error(`Error fetching campaigns for account ${adAccountId}:`, err);
      }
    }));

    // Add delay between chunks
    if (i + CHUNK_SIZE < adAccountIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return allCampaigns.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * POST endpoint to manually invalidate cache
 * Useful when user creates/updates/deletes campaigns
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, adAccountIds } = await request.json();

    if (action === 'invalidate-cache') {
      // Clear cache for specific accounts
      const cacheKey = generateCacheKey(
        'meta:campaigns',
        session.user.id!,
        adAccountIds.sort().join(',')
      );
      
      await deleteCache(cacheKey);

      return NextResponse.json({ 
        success: true,
        message: 'Cache invalidated' 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in POST /api/campaigns:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
