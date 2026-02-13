/**
 * POST /api/launch
 * Launch a new Messages campaign with N ads
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import MetaAPIClient, { createThailandTargeting } from '@/lib/services/metaClient';
import { generateAdCopies } from '@/lib/services/aiCopyService';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { csrfProtection } from '@/lib/middleware/csrf';
import { launchCampaignSchema, validateRequestBody } from '@/lib/validation';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const {
      videoPath,
      pageId,
      numberOfAds,
      campaignName,
      dailyBudget = 20, // USD
      productContext,
    } = body;

    // 3. Validation
    if (!videoPath || !pageId || !numberOfAds) {
      return NextResponse.json(
        { error: 'Missing required fields: videoPath, pageId, numberOfAds' },
        { status: 400 }
      );
    }

    if (numberOfAds < 1 || numberOfAds > 10) {
      return NextResponse.json(
        { error: 'numberOfAds must be between 1 and 10' },
        { status: 400 }
      );
    }

    // 3. Get user's Meta account
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { metaAccount: true },
    });

    if (!user?.metaAccount) {
      return NextResponse.json(
        { error: 'Meta account not connected. Please connect your Facebook account first.' },
        { status: 400 }
      );
    }

    const { accessToken, adAccountId, pageAccessToken } = user.metaAccount;
    if (!adAccountId) {
      return NextResponse.json(
        { error: 'Ad account not selected. Please select an ad account in settings.' },
        { status: 400 }
      );
    }

    // 5. Initialize Meta client
    const metaClient = new MetaAPIClient(accessToken);

    // 6. Upload video to Meta
    console.log('Uploading video to Meta...');
    const videoUpload = await metaClient.uploadVideo(
      adAccountId,
      videoPath,
      `Video-${Date.now()}`
    );
    const videoAssetId = videoUpload.id;

    // 7. Create Campaign
    const finalCampaignName = campaignName || `Messages Campaign ${new Date().toISOString()}`;
    console.log('Creating campaign:', finalCampaignName);

    const campaignResult = await metaClient.createCampaign(
      adAccountId,
      finalCampaignName,
      'MESSAGES',
      'PAUSED' // Start paused, will activate after all setup
    );
    const metaCampaignId = campaignResult.id;

    // Save campaign to database
    const campaign = await prisma.campaign.create({
      data: {
        metaCampaignId,
        name: finalCampaignName,
        objective: 'MESSAGES',
        status: 'PAUSED',
        dailyBudget,
        videoPath,
        videoAssetId,
        metaAccountId: user.metaAccount.id,
      },
    });

    // 8. Create Ad Set
    console.log('Creating ad set...');

    // --- SMART TARGETING (DB ENHANCED) ---
    // 1. Generate Interest Candidates from DB
    const { interests: interestCandidates, minAge } = await import('@/lib/services/targetingService')
      .then(m => m.generateSmartTargeting(productContext || ''));

    console.log(`Generated Interest Candidates from DB: ${interestCandidates.map(i => i.name).join(', ')}`);

    // 2. Use DB IDs directly (no need to re-search)
    const validatedInterests = interestCandidates.map(i => ({ id: i.id, name: i.name }));

    // 3. Construct Targeting Object
    const targeting = createThailandTargeting(minAge);

    // If we have valid interests, add them to flexible_spec
    if (validatedInterests.length > 0) {
      (targeting as any)['flexible_spec'] = [
        {
          interests: validatedInterests
        }
      ];
    }
    // --- SMART TARGETING END ---

    const adSetResult = await metaClient.createAdSet({
      campaignId: metaCampaignId,
      name: `AdSet - ${finalCampaignName}`,
      dailyBudget: dailyBudget * 100, // Convert to cents
      targeting,
      status: 'PAUSED',
      pageId,
    });
    const metaAdSetId = adSetResult.id;

    // Save ad set to database
    const adSet = await prisma.adSet.create({
      data: {
        metaAdSetId,
        campaignId: campaign.id,
        status: 'PAUSED',
        targeting,
        dailyBudget,
      },
    });

    // 9. Generate ad copies using AI
    console.log(`Generating ${numberOfAds} ad copy variations...`);
    const adCopies = await generateAdCopies({
      productContext: productContext || 'general product or service',
      tone: 'friendly',
      numberOfVariations: numberOfAds,
    });

    // 10. Create ads
    console.log('Creating ads...');
    const createdAds = [];

    for (let i = 0; i < numberOfAds; i++) {
      const copy = adCopies[i] || adCopies[0]; // Fallback to first copy if not enough

      // Create ad creative
      const creativeResult = await metaClient.createAdCreative({
        adAccountId,
        name: `Creative ${i + 1} - ${finalCampaignName}`,
        pageId,
        videoId: videoAssetId,
        message: `${copy.primaryTextTH}\n\n${copy.primaryTextEN}`,
        link: `https://m.me/${pageId}`,
      });

      // Save creative to database
      const creative = await prisma.adCreative.create({
        data: {
          metaCreativeId: creativeResult.id,
          videoAssetId,
          primaryTextTH: copy.primaryTextTH,
          primaryTextEN: copy.primaryTextEN,
          headlineTH: copy.headlineTH,
          headlineEN: copy.headlineEN,
          ctaMessagePromptTH: copy.ctaMessagePromptTH,
          ctaMessagePromptEN: copy.ctaMessagePromptEN,
        },
      });

      // Create ad
      const adResult = await metaClient.createAd({
        adSetId: metaAdSetId,
        adAccountId,
        name: `Ad ${i + 1} - ${finalCampaignName}`,
        creativeId: creativeResult.id,
        status: 'PAUSED',
      });

      // Save ad to database
      const ad = await prisma.ad.create({
        data: {
          metaAdId: adResult.id,
          adSetId: adSet.id,
          status: 'PAUSED',
          adCreativeId: creative.id,
        },
      });

      createdAds.push({
        id: ad.id,
        metaAdId: adResult.id,
        primaryTextTH: copy.primaryTextTH,
        primaryTextEN: copy.primaryTextEN,
      });
    }

    // 11. Activate campaign and all ads
    console.log('Activating campaign and ads...');
    await metaClient.updateCampaignStatus(metaCampaignId, 'ACTIVE');
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'ACTIVE' },
    });

    for (const ad of createdAds) {
      await metaClient.updateAdStatus(ad.metaAdId, 'ACTIVE');
      await prisma.ad.update({
        where: { id: ad.id },
        data: { status: 'ACTIVE' },
      });
    }

    // 12. Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE_CAMPAIGN',
        entityType: 'Campaign',
        entityId: campaign.id,
        campaignId: campaign.id,
        details: {
          numberOfAds,
          dailyBudget,
          pageId,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      },
    });

    // 13. Return success
    return NextResponse.json(
      {
        success: true,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          metaCampaignId,
          status: 'ACTIVE',
          numberOfAds: createdAds.length,
        },
        ads: createdAds,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error launching campaign:', error);

    return NextResponse.json(
      {
        error: 'Failed to launch campaign',
        message: error.message,
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

// GET /api/launch - Get launch requirements/validation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { 
        metaAccount: true,
        accounts: {
          where: { provider: 'facebook' },
        },
      },
    });

    // Check if user has Facebook connected (either MetaAccount or NextAuth Account)
    const hasMetaAccount = !!user?.metaAccount;
    const hasFacebookAccount = user?.accounts && user.accounts.length > 0;
    const isMetaConnected = hasMetaAccount || hasFacebookAccount;
    
    const hasAdAccount = !!user?.metaAccount?.adAccountId;
    const hasPage = !!user?.metaAccount?.pageId;

    return NextResponse.json({
      ready: isMetaConnected && hasAdAccount && hasPage,
      checks: {
        metaConnected: isMetaConnected,
        adAccountSelected: hasAdAccount,
        pageSelected: hasPage,
      },
      metaAccount: user?.metaAccount
        ? {
          adAccountName: user.metaAccount.adAccountName,
          pageName: user.metaAccount.pageName,
        }
        : null,
    });
  } catch (error) {
    console.error('Error checking launch requirements:', error);
    return NextResponse.json(
      { error: 'Failed to check requirements' },
      { status: 500 }
    );
  }
}
