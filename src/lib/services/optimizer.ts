/**
 * Campaign Optimizer Service
 * Applies rules-based optimization to campaigns/ads based on performance data
 */

import { PrismaClient } from '@prisma/client';
import MetaAPIClient, { extractMessageCount, calculateCostPerMessage } from './metaClient';

const prisma = new PrismaClient();

// Configuration from ENV
const WARMUP_HOURS = parseInt(process.env.WARMUP_HOURS || '3', 10);
const MAX_SPEND_NO_MESSAGES = parseFloat(process.env.MAX_SPEND_NO_MESSAGES || '5');
const COST_THRESHOLD_MULTIPLIER = parseFloat(
  process.env.COST_PER_MESSAGE_THRESHOLD_MULTIPLIER || '1.5'
);
const MIN_MESSAGES_FOR_WINNER = parseInt(process.env.MIN_MESSAGES_FOR_WINNER || '3', 10);

interface OptimizationResult {
  campaignId: string;
  actions: OptimizationAction[];
  summary: string;
}

interface OptimizationAction {
  entityType: 'Campaign' | 'AdSet' | 'Ad';
  entityId: string;
  action: 'PAUSE' | 'RESUME' | 'MARK_WINNER';
  reason: string;
  metadata?: any;
}

/**
 * Main optimization function - runs every 15 minutes
 */
export async function optimizeAllCampaigns(metaAccessToken: string): Promise<OptimizationResult[]> {
  const metaClient = new MetaAPIClient(metaAccessToken);
  const results: OptimizationResult[] = [];

  // Get all active campaigns
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: {
        in: ['ACTIVE', 'PAUSED'],
      },
    },
    include: {
      adSets: {
        include: {
          ads: {
            include: {
              adCreative: true,
              insights: {
                orderBy: { date: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
      insights: {
        orderBy: { date: 'desc' },
        take: 7,
      },
    },
  });

  for (const campaign of campaigns) {
    try {
      const result = await optimizeCampaign(campaign, metaClient);
      results.push(result);
    } catch (error) {
      console.error(`Error optimizing campaign ${campaign.id}:`, error);
    }
  }

  return results;
}

/**
 * Optimize a single campaign
 */
async function optimizeCampaign(campaign: any, metaClient: MetaAPIClient): Promise<OptimizationResult> {
  const actions: OptimizationAction[] = [];

  // Check if campaign is in warmup period
  const campaignAge = Date.now() - campaign.createdAt.getTime();
  const warmupPeriod = WARMUP_HOURS * 60 * 60 * 1000;
  const isInWarmup = campaignAge < warmupPeriod;

  if (isInWarmup) {
    console.log(`Campaign ${campaign.id} is in warmup period, skipping optimization`);
    return {
      campaignId: campaign.id,
      actions: [],
      summary: `Campaign in warmup period (${Math.round(campaignAge / (60 * 60 * 1000))}/${WARMUP_HOURS} hours)`,
    };
  }

  // Get fresh insights from Meta
  try {
    const campaignInsights = await metaClient.getCampaignInsights(campaign.metaCampaignId, 'today');
    
    // Save insights to database
    if (campaignInsights.data && campaignInsights.data.length > 0) {
      const insight = campaignInsights.data[0];
      const messages = extractMessageCount(insight);
      const spend = parseFloat(insight.spend || '0');
      const costPerMessage = calculateCostPerMessage(spend, messages);

      await prisma.campaignInsight.upsert({
        where: {
          campaignId_date: {
            campaignId: campaign.id,
            date: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        create: {
          campaignId: campaign.id,
          date: new Date(new Date().setHours(0, 0, 0, 0)),
          spend,
          messages,
          costPerMessage: costPerMessage || 0,
        },
        update: {
          spend,
          messages,
          costPerMessage: costPerMessage || 0,
        },
      });
    }
  } catch (error) {
    console.error(`Error fetching campaign insights for ${campaign.id}:`, error);
  }

  // Optimize each ad in the campaign
  for (const adSet of campaign.adSets) {
    for (const ad of adSet.ads) {
      const adActions = await optimizeAd(ad, campaign, metaClient, isInWarmup);
      actions.push(...adActions);
    }
  }

  // Analyze campaign-level performance
  const campaignActions = await analyzeCampaignPerformance(campaign, metaClient);
  actions.push(...campaignActions);

  // Execute all actions
  for (const action of actions) {
    await executeOptimizationAction(action, metaClient);
  }

  const summary = generateOptimizationSummary(actions);

  return {
    campaignId: campaign.id,
    actions,
    summary,
  };
}

/**
 * Optimize individual ad
 */
async function optimizeAd(
  ad: any,
  campaign: any,
  metaClient: MetaAPIClient,
  isInWarmup: boolean
): Promise<OptimizationAction[]> {
  const actions: OptimizationAction[] = [];

  // Skip if already paused
  if (ad.status === 'PAUSED') {
    return actions;
  }

  // Get ad insights
  try {
    const adInsights = await metaClient.getAdInsights(ad.metaAdId, 'today');
    
    if (adInsights.data && adInsights.data.length > 0) {
      const insight = adInsights.data[0];
      const messages = extractMessageCount(insight);
      const spend = parseFloat(insight.spend || '0');
      const costPerMessage = calculateCostPerMessage(spend, messages);

      // Save insights
      await prisma.adInsight.upsert({
        where: {
          adId_date: {
            adId: ad.id,
            date: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        create: {
          adId: ad.id,
          date: new Date(new Date().setHours(0, 0, 0, 0)),
          spend,
          messages,
          costPerMessage: costPerMessage || 0,
        },
        update: {
          spend,
          messages,
          costPerMessage: costPerMessage || 0,
        },
      });

      let shouldPause = false;
      let pauseReason = '';

      if (spend >= MAX_SPEND_NO_MESSAGES && messages === 0) {
        shouldPause = true;
        pauseReason = `Spent $${spend.toFixed(2)} with 0 messages (threshold: $${MAX_SPEND_NO_MESSAGES})`;
      } else if (messages > 0 && costPerMessage && costPerMessage !== Infinity) {
        const campaignMedianCPM = await calculateCampaignMedianCPM(campaign.id);
        if (campaignMedianCPM) {
          const threshold = campaignMedianCPM * COST_THRESHOLD_MULTIPLIER;
          if (costPerMessage > threshold) {
            shouldPause = true;
            pauseReason = `Cost per message ($${costPerMessage.toFixed(2)}) exceeds threshold ($${threshold.toFixed(2)})`;
          }
        }
      }

      if (shouldPause && !isInWarmup) {
        actions.push({
          entityType: 'Ad',
          entityId: ad.id,
          action: 'PAUSE',
          reason: pauseReason,
          metadata: { spend, messages, costPerMessage },
        });
      } else if (!shouldPause && messages >= MIN_MESSAGES_FOR_WINNER && costPerMessage && !ad.isWinner && !isInWarmup) {
        const campaignAvgCPM = await calculateCampaignAverageCPM(campaign.id);
        if (campaignAvgCPM && costPerMessage < campaignAvgCPM) {
          actions.push({
            entityType: 'Ad',
            entityId: ad.id,
            action: 'MARK_WINNER',
            reason: `Winner: ${messages} messages at $${costPerMessage.toFixed(2)} (below avg $${campaignAvgCPM.toFixed(2)})`,
            metadata: { messages, costPerMessage, campaignAvgCPM },
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error optimizing ad ${ad.id}:`, error);
  }

  return actions;
}

/**
 * Analyze campaign-level performance
 */
async function analyzeCampaignPerformance(
  campaign: any,
  metaClient: MetaAPIClient
): Promise<OptimizationAction[]> {
  const actions: OptimizationAction[] = [];

  // Check if all ads are paused
  const activeAdsCount = campaign.adSets.reduce((count: number, adSet: any) => {
    return count + adSet.ads.filter((ad: any) => ad.status === 'ACTIVE').length;
  }, 0);

  if (activeAdsCount === 0 && campaign.status === 'ACTIVE') {
    actions.push({
      entityType: 'Campaign',
      entityId: campaign.id,
      action: 'PAUSE',
      reason: 'All ads are paused, pausing campaign',
      metadata: { activeAdsCount: 0 },
    });
  }

  return actions;
}

/**
 * Calculate median cost per message for a campaign
 */
async function calculateCampaignMedianCPM(campaignId: string): Promise<number | null> {
  const insights = await prisma.adInsight.findMany({
    where: {
      ad: {
        adSet: {
          campaignId,
        },
      },
      messages: {
        gt: 0,
      },
      costPerMessage: {
        gt: 0,
      },
    },
    orderBy: {
      costPerMessage: 'asc',
    },
  });

  if (insights.length === 0) return null;

  const mid = Math.floor(insights.length / 2);
  return insights.length % 2 === 0
    ? (insights[mid - 1].costPerMessage + insights[mid].costPerMessage) / 2
    : insights[mid].costPerMessage;
}

/**
 * Calculate average cost per message for a campaign
 */
async function calculateCampaignAverageCPM(campaignId: string): Promise<number | null> {
  const result = await prisma.adInsight.aggregate({
    where: {
      ad: {
        adSet: {
          campaignId,
        },
      },
      messages: {
        gt: 0,
      },
      costPerMessage: {
        gt: 0,
      },
    },
    _avg: {
      costPerMessage: true,
    },
  });

  return result._avg.costPerMessage;
}

/**
 * Execute optimization action
 */
async function executeOptimizationAction(
  action: OptimizationAction,
  metaClient: MetaAPIClient
): Promise<void> {
  try {
    if (action.action === 'PAUSE') {
      if (action.entityType === 'Ad') {
        const ad = await prisma.ad.findUnique({ where: { id: action.entityId } });
        if (ad) {
          await metaClient.updateAdStatus(ad.metaAdId, 'PAUSED');
          await prisma.ad.update({
            where: { id: action.entityId },
            data: { status: 'PAUSED' },
          });
        }
      } else if (action.entityType === 'Campaign') {
        const campaign = await prisma.campaign.findUnique({ where: { id: action.entityId } });
        if (campaign) {
          await metaClient.updateCampaignStatus(campaign.metaCampaignId, 'PAUSED');
          await prisma.campaign.update({
            where: { id: action.entityId },
            data: { status: 'PAUSED' },
          });
        }
      }
    } else if (action.action === 'MARK_WINNER') {
      await prisma.ad.update({
        where: { id: action.entityId },
        data: { isWinner: true },
      });
    }

    // Log decision
    await prisma.decisionLog.create({
      data: {
        entityType: action.entityType,
        entityId: action.entityId,
        action: action.action,
        reason: action.reason,
        metadata: action.metadata || {},
      },
    });
  } catch (error) {
    console.error(`Error executing action for ${action.entityType} ${action.entityId}:`, error);
  }
}

/**
 * Generate optimization summary
 */
function generateOptimizationSummary(actions: OptimizationAction[]): string {
  if (actions.length === 0) {
    return 'No optimization actions needed';
  }

  const pausedAds = actions.filter((a) => a.entityType === 'Ad' && a.action === 'PAUSE').length;
  const pausedCampaigns = actions.filter((a) => a.entityType === 'Campaign' && a.action === 'PAUSE').length;
  const winners = actions.filter((a) => a.action === 'MARK_WINNER').length;

  return `Paused ${pausedAds} ads, ${pausedCampaigns} campaigns, marked ${winners} winners`;
}

export default {
  optimizeAllCampaigns,
};
