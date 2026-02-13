/**
 * GET /api/campaigns/[id]
 * Get campaign details with all ads and metrics
 * 
 * PATCH /api/campaigns/[id]
 * Update campaign (pause/resume)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import MetaAPIClient from '@/lib/services/metaClient';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { csrfProtection } from '@/lib/middleware/csrf';
import { updateCampaignStatusSchema, validateRequestBody } from '@/lib/validation';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    // Rate limiting
    const rateLimitResponse = await rateLimit(request, RateLimitPresets.relaxed);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;

    // Get campaign with full details
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        metaAccount: {
          include: {
            user: true,
          },
        },
        adSets: {
          include: {
            ads: {
              include: {
                adCreative: true,
                insights: {
                  where: {
                    date: new Date(new Date().setHours(0, 0, 0, 0)),
                  },
                  take: 1,
                },
              },
            },
          },
        },
        insights: {
          orderBy: {
            date: 'desc',
          },
          take: 7, // Last 7 days
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check ownership
    if (campaign.metaAccount.user.email !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Format ads with metrics
    const ads = campaign.adSets.flatMap((adSet: any) =>
      adSet.ads.map((ad: any) => {
        const todayInsight = ad.insights[0];
        return {
          id: ad.id,
          metaAdId: ad.metaAdId,
          status: ad.status,
          isWinner: ad.isWinner,
          creative: {
            primaryTextTH: ad.adCreative.primaryTextTH,
            primaryTextEN: ad.adCreative.primaryTextEN,
            headlineTH: ad.adCreative.headlineTH,
            headlineEN: ad.adCreative.headlineEN,
          },
          metrics: todayInsight
            ? {
              spend: todayInsight.spend,
              messages: todayInsight.messages,
              costPerMessage: todayInsight.costPerMessage,
            }
            : null,
          createdAt: ad.createdAt,
        };
      })
    );

    // Format insights
    const insights = campaign.insights.map((insight: any) => ({
      date: insight.date,
      spend: insight.spend,
      messages: insight.messages,
      costPerMessage: insight.costPerMessage,
    }));

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        dailyBudget: campaign.dailyBudget,
        createdAt: campaign.createdAt,
        videoPath: campaign.videoPath,
      },
      ads,
      insights,
      summary: {
        totalAds: ads.length,
        activeAds: ads.filter((ad: any) => ad.status === 'ACTIVE').length,
        winners: ads.filter((ad: any) => ad.isWinner).length,
        totalSpend: insights.reduce((sum: number, i: any) => sum + i.spend, 0),
        totalMessages: insights.reduce((sum: number, i: any) => sum + i.messages, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    // Rate limiting
    const rateLimitResponse = await rateLimit(request, RateLimitPresets.strict);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // CSRF protection
    const csrfResponse = csrfProtection(request);
    if (csrfResponse) {
      return csrfResponse;
    }

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;
    const body = await request.json();
    const { action } = body; // 'pause', 'resume', 'archive'

    if (!['pause', 'resume', 'archive'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        metaAccount: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check ownership
    if (campaign.metaAccount.user.email !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update via Meta API
    const metaClient = new MetaAPIClient(campaign.metaAccount.accessToken);

    const statusMap: Record<string, 'ACTIVE' | 'PAUSED' | 'ARCHIVED'> = {
      pause: 'PAUSED',
      resume: 'ACTIVE',
      archive: 'ARCHIVED',
    };
    const newStatus = statusMap[action];

    await metaClient.updateCampaignStatus(campaign.metaCampaignId, newStatus);

    // Update database
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: newStatus },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: campaign.metaAccount.user.id,
        action: `${action.toUpperCase()}_CAMPAIGN`,
        entityType: 'Campaign',
        entityId: campaignId,
        campaignId,
        details: { newStatus },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: updatedCampaign.id,
        status: updatedCampaign.status,
      },
    });
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      {
        error: 'Failed to update campaign',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
