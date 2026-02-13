/**
 * PATCH /api/ads/[id]
 * Update ad status (pause/resume)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import MetaAPIClient from '@/lib/services/metaClient';

const prisma = new PrismaClient();

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adId = params.id;
    const body = await request.json();
    const { action } = body; // 'pause', 'resume'

    if (!['pause', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get ad with campaign info
    const ad = await prisma.ad.findUnique({
      where: { id: adId },
      include: {
        adSet: {
          include: {
            campaign: {
              include: {
                metaAccount: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    // Check ownership
    if (ad.adSet.campaign.metaAccount.user.email !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update via Meta API
    const metaClient = new MetaAPIClient(ad.adSet.campaign.metaAccount.accessToken);
    const newStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE';

    await metaClient.updateAdStatus(ad.metaAdId, newStatus);

    // Update database
    const updatedAd = await prisma.ad.update({
      where: { id: adId },
      data: { status: newStatus },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: ad.adSet.campaign.metaAccount.user.id,
        action: `${action.toUpperCase()}_AD`,
        entityType: 'Ad',
        entityId: adId,
        adId,
        campaignId: ad.adSet.campaign.id,
        details: { newStatus },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    });

    return NextResponse.json({
      success: true,
      ad: {
        id: updatedAd.id,
        status: updatedAd.status,
      },
    });
  } catch (error: any) {
    console.error('Error updating ad:', error);
    return NextResponse.json(
      {
        error: 'Failed to update ad',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
