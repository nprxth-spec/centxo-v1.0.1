/**
 * POST /api/cron/optimize
 * Runs campaign optimization every 15 minutes
 * Should be called by cron-job.org or similar service
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { optimizeAllCampaigns } from '@/lib/services/optimizer';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // 1. Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting optimization job...');
    const startTime = Date.now();

    // 2. Get all Meta accounts that need optimization
    const metaAccounts = await prisma.metaAccount.findMany({
      include: {
        campaigns: {
          where: {
            status: {
              in: ['ACTIVE', 'PAUSED'],
            },
          },
        },
      },
    });

    console.log(`[CRON] Found ${metaAccounts.length} Meta accounts to optimize`);

    const results = [];

    // 3. Optimize campaigns for each Meta account
    for (const metaAccount of metaAccounts) {
      if (metaAccount.campaigns.length === 0) {
        continue;
      }

      try {
        console.log(
          `[CRON] Optimizing ${metaAccount.campaigns.length} campaigns for account ${metaAccount.id}`
        );

        const optimizationResults = await optimizeAllCampaigns(metaAccount.accessToken);

        results.push({
          metaAccountId: metaAccount.id,
          userId: metaAccount.userId,
          campaignsOptimized: optimizationResults.length,
          results: optimizationResults,
        });
      } catch (error) {
        console.error(`[CRON] Error optimizing account ${metaAccount.id}:`, error);
        results.push({
          metaAccountId: metaAccount.id,
          userId: metaAccount.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[CRON] Optimization job completed in ${duration}ms`);

    // 4. Return summary
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      accountsProcessed: metaAccounts.length,
      results,
    });
  } catch (error) {
    console.error('[CRON] Optimization job failed:', error);
    return NextResponse.json(
      {
        error: 'Optimization job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/status check
export async function GET(request: NextRequest) {
  try {
    // Check if authenticated
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get optimization stats
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentDecisions = await prisma.decisionLog.groupBy({
      by: ['action'],
      where: {
        createdAt: {
          gte: last24Hours,
        },
      },
      _count: true,
    });

    const activeCampaigns = await prisma.campaign.count({
      where: {
        status: 'ACTIVE',
      },
    });

    const recentAudits = await prisma.auditLog.count({
      where: {
        createdAt: {
          gte: last24Hours,
        },
      },
    });

    return NextResponse.json({
      status: 'healthy',
      stats: {
        activeCampaigns,
        last24Hours: {
          decisions: recentDecisions,
          auditLogs: recentAudits,
        },
      },
      config: {
        warmupHours: process.env.WARMUP_HOURS || '3',
        maxSpendNoMessages: process.env.MAX_SPEND_NO_MESSAGES || '5',
        costThresholdMultiplier: process.env.COST_PER_MESSAGE_THRESHOLD_MULTIPLIER || '1.5',
        minMessagesForWinner: process.env.MIN_MESSAGES_FOR_WINNER || '3',
      },
    });
  } catch (error) {
    console.error('[CRON] Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
