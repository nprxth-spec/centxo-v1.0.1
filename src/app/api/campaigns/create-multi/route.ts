import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { invalidateUserCache } from '@/lib/cache/redis';
import { authOptions } from '@/lib/auth';
import { videoStorage } from '@/lib/video-storage';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { analyzeMediaForAd } from '@/ai/flows/analyze-media-for-ad';

// Helper function to search for Facebook interest IDs
async function searchInterestId(interestName: string, accessToken: string): Promise<string | null> {
  try {
    const searchUrl = `https://graph.facebook.com/v22.0/search?type=adinterest&q=${encodeURIComponent(interestName)}&limit=1&access_token=${accessToken}`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Failed to search interest "${interestName}":`, error);
    return null;
  }
}

// Helper function to convert interest names to IDs
async function getInterestIds(interestNames: string[], accessToken: string): Promise<Array<{ id: string, name: string }>> {
  const interestObjects: Array<{ id: string, name: string }> = [];

  for (const name of interestNames) {
    const id = await searchInterestId(name, accessToken);
    if (id) {
      interestObjects.push({ id, name });
      console.log(`✓ Found interest ID for "${name}": ${id}`);
    } else {
      console.warn(`✗ Could not find interest ID for "${name}", skipping`);
    }
  }

  return interestObjects;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const mediaCount = parseInt(formData.get('mediaCount') as string) || 0;
    const adAccountId = formData.get('adAccountId') as string;
    const campaignObjective = formData.get('campaignObjective') as string;
    const pageId = formData.get('pageId') as string;
    const dailyBudgetInput = formData.get('dailyBudget') as string;
    const adSetCount = parseInt(formData.get('adSetCount') as string) || 1;
    const adsCount = parseInt(formData.get('adsCount') as string) || 1;
    const productContext = formData.get('productContext') as string; // Extract product context

    if (!adAccountId || !campaignObjective || !pageId || mediaCount === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process all media files
    const mediaFiles: Array<{ url: string; path: string; type: 'video' | 'image' }> = [];

    for (let i = 0; i < mediaCount; i++) {
      const file = formData.get(`file_${i}`) as File | null;
      const existingVideo = formData.get(`existingVideo_${i}`) as string | null;
      const mediaType = formData.get(`mediaType_${i}`) as string;

      if (existingVideo) {
        // Use existing file
        const possiblePaths = [
          path.join(process.cwd(), 'uploads', 'videos', session.user.id, existingVideo),
          path.join(process.cwd(), 'uploads', session.user.id, existingVideo),
        ];

        let foundPath: string | null = null;
        for (const testPath of possiblePaths) {
          if (existsSync(testPath)) {
            foundPath = testPath;
            break;
          }
        }

        if (!foundPath) {
          return NextResponse.json(
            { error: `File not found: ${existingVideo}` },
            { status: 404 }
          );
        }

        const isInVideosFolder = foundPath.includes(path.join('uploads', 'videos'));
        const url = isInVideosFolder
          ? `/api/uploads/videos/${session.user.id}/${existingVideo}`
          : `/api/uploads/${session.user.id}/${existingVideo}`;

        mediaFiles.push({
          url,
          path: foundPath,
          type: mediaType as 'video' | 'image',
        });
      } else if (file) {
        // Upload new file
        const uploadResult = await videoStorage.upload(file, session.user.id);

        if (!uploadResult.success) {
          return NextResponse.json(
            { error: `Media upload failed: ${uploadResult.error}` },
            { status: 500 }
          );
        }

        mediaFiles.push({
          url: uploadResult.url!,
          path: uploadResult.filePath!,
          type: mediaType as 'video' | 'image',
        });
      }
    }

    console.log(`✓ Processed ${mediaFiles.length} media files`);

    // Analyze first media file for AI analysis
    const firstMedia = mediaFiles[0];
    let aiAnalysis;
    try {
      const buffer = await fs.readFile(firstMedia.path);
      const mimeType = firstMedia.type === 'video' ? 'video/mp4' : 'image/jpeg';
      const mediaDataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

      // Generate random context for high entropy
      const randomSeed = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      console.log('🤖 STARTING AI ANALYSIS (Multi)');
      console.log(`- Media Type: ${firstMedia.type}`);
      console.log(`- Data URI Length: ${mediaDataUri.length}`);
      console.log(`- Product Context: "${productContext}"`);
      console.log(`- AdSet Count Requested: ${adSetCount}`);

      aiAnalysis = await analyzeMediaForAd({
        mediaUrl: mediaDataUri,
        mediaType: firstMedia.type as 'video' | 'image',
        productContext: productContext,
        isVideoFile: firstMedia.type === 'video', // Add this flag
        adSetCount: adSetCount + 2, // Request buffer
        randomContext: randomSeed
      });

      console.log('🤖 AI ANALYSIS RESULT:');
      console.log(JSON.stringify(aiAnalysis, null, 2));

      // Force high confidence if it seems low
      if (aiAnalysis.confidence < 0.7) {
        console.warn(`Low confidence detected: ${aiAnalysis.confidence}. Keeping raw result.`);
      }

      // Add simple fallback if category is totally missing
      if (!aiAnalysis.productCategory) {
        aiAnalysis.productCategory = 'สินค้าทั่วไป';
      }

    } catch (aiError) {
      console.error('AI Analysis failed, using defaults:', aiError);
      aiAnalysis = {
        primaryText: 'สนใจสินค้าทักแชทได้เลยครับ 💬',
        headline: 'ทักแชทสอบถามเพิ่มเติม',
        ctaMessage: 'ทักแชทเลย',
        interests: ['Shopping and Fashion', 'Online Shopping'],
        ageMin: 20,
        ageMax: 65,
        productCategory: 'สินค้าทั่วไป',
        confidence: 0.5,
        interestGroups: [
          { name: 'กลุ่มทั่วไป', interests: ['Shopping and Fashion', 'Online Shopping'] },
        ],
        adCopyVariations: [
          { primaryText: 'สนใจสินค้าทักแชทได้เลยครับ 💬', headline: 'ทักแชทสอบถามเพิ่มเติม' },
        ],
      };
    }

    // Get Facebook access token
    const userAccounts = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'facebook',
      },
    });

    if (!userAccounts?.access_token) {
      return NextResponse.json(
        { error: 'Facebook account not connected' },
        { status: 400 }
      );
    }

    const accessToken = userAccounts.access_token;

    // Get Ad Account info for currency
    console.log('Fetching Ad Account info for currency...');
    const adAccountResponse = await fetch(
      `https://graph.facebook.com/v22.0/act_${adAccountId}?fields=currency&access_token=${accessToken}`
    );
    const adAccountData = await adAccountResponse.json();
    const currency = adAccountData.currency || 'USD';
    console.log('Account currency:', currency);

    // Convert daily budget
    const dailyBudgetFloat = parseFloat(dailyBudgetInput);
    const dailyBudget = Math.round(dailyBudgetFloat * 100);
    console.log(`Using user budget: ${dailyBudgetFloat} ${currency} = ${dailyBudget} (smallest unit)`);

    // Create ONE campaign
    const campaignPayload = {
      name: `Campaign - ${aiAnalysis.productCategory} - ${new Date().toLocaleDateString('th-TH')} - Multi Media`,
      objective: campaignObjective,
      status: 'ACTIVE',
      special_ad_categories: [],
      access_token: accessToken,
    };

    console.log('Creating campaign on Facebook');
    const campaignResponse = await fetch(
      `https://graph.facebook.com/v22.0/act_${adAccountId}/campaigns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignPayload),
      }
    );

    const campaignData = await campaignResponse.json();

    if (!campaignResponse.ok || campaignData.error) {
      console.error('Campaign creation failed:', campaignData);
      return NextResponse.json(
        { error: `Campaign creation failed: ${campaignData.error?.message}` },
        { status: 400 }
      );
    }

    const campaignId = campaignData.id;
    console.log('✓ Campaign created:', campaignId);

    // Upload all media to Facebook
    const fbMediaIds: string[] = [];
    for (const media of mediaFiles) {
      if (media.type === 'image') {
        const imageBuffer = await fs.readFile(media.path);
        const imageFormData = new FormData();
        imageFormData.append('bytes', new Blob([new Uint8Array(imageBuffer)]));
        imageFormData.append('access_token', accessToken);

        const imageResponse = await fetch(
          `https://graph.facebook.com/v22.0/act_${adAccountId}/adimages`,
          {
            method: 'POST',
            body: imageFormData,
          }
        );

        const imageData = await imageResponse.json();
        if (!imageResponse.ok || imageData.error) {
          return NextResponse.json(
            { error: `Image upload failed: ${imageData.error?.message}` },
            { status: 400 }
          );
        }

        const imageHash = Object.keys(imageData.images || {})[0];
        fbMediaIds.push(imageData.images[imageHash].hash);
        console.log('✓ Image uploaded to Facebook:', imageData.images[imageHash].hash);
      }
    }

    // Create AdSets
    const adSetIds: string[] = [];
    for (let i = 0; i < adSetCount; i++) {
      const interestGroup = aiAnalysis.interestGroups?.[i % (aiAnalysis.interestGroups?.length || 1)] || {
        name: 'General',
        interests: aiAnalysis.interests || ['Shopping and Fashion']
      };

      const loopTargeting: any = {
        geo_locations: { countries: ['TH'] },
        age_min: Math.max(Number(aiAnalysis.ageMin) || 20, 20), // Enforce minimum 20 for Thailand
        age_max: Number(aiAnalysis.ageMax) || 65,
        publisher_platforms: ['facebook', 'instagram', 'messenger'],
      };

      console.log(`🔍 Searching interest IDs for AdSet ${i + 1}:`, interestGroup.interests);
      const interestObjects = await getInterestIds(interestGroup.interests, accessToken);

      if (interestObjects.length > 0) {
        loopTargeting.flexible_spec = [{ interests: interestObjects }];
      }

      const adSetPayloadForLoop = {
        name: `AdSet - ${aiAnalysis.productCategory} - ${new Date().toLocaleDateString('th-TH')} - ${interestGroup.name} #${i + 1}`,
        campaign_id: campaignId,
        optimization_goal: 'CONVERSATIONS',
        billing_event: 'IMPRESSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: Number(dailyBudget),
        status: 'ACTIVE',
        destination_type: 'MESSENGER',
        targeting: loopTargeting,
        promoted_object: { page_id: pageId },
        access_token: accessToken,
      };

      const adSetResponse = await fetch(
        `https://graph.facebook.com/v22.0/act_${adAccountId}/adsets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adSetPayloadForLoop),
        }
      );

      const adSetData = await adSetResponse.json();

      if (!adSetResponse.ok || adSetData.error) {
        console.error(`AdSet ${i + 1} creation failed:`, JSON.stringify(adSetData, null, 2));
        return NextResponse.json(
          { error: `AdSet ${i + 1} creation failed: ${adSetData.error?.message}` },
          { status: 400 }
        );
      }

      adSetIds.push(adSetData.id);
      console.log(`✓ AdSet ${i + 1} created`);
    }

    // Separate images and videos
    const imageMediaIds = fbMediaIds.filter((_, idx) => mediaFiles[idx].type === 'image');
    const videoMediaFiles = mediaFiles.filter(m => m.type === 'video');
    const hasImages = imageMediaIds.length > 0;
    const hasVideos = videoMediaFiles.length > 0;

    console.log(`Media breakdown: ${imageMediaIds.length} images, ${videoMediaFiles.length} videos`);

    // Create Ads
    const adIds: string[] = [];

    // Strategy:
    // - If all images: Create carousel ads (all images in each ad)
    // - If all videos: Create separate ads (1 video per ad)
    // - If mixed: Create carousel for images + separate ads for videos

    if (hasImages) {
      // Create ads with carousel (all images in one ad)
      for (let i = 0; i < adsCount; i++) {
        const adSetId = adSetIds[i % adSetIds.length];

        const copyVariation = aiAnalysis.adCopyVariations?.[i % (aiAnalysis.adCopyVariations?.length || 1)] || {
          primaryText: aiAnalysis.primaryText,
          headline: aiAnalysis.headline,
        };

        // Build carousel with all images
        const childAttachments = imageMediaIds.map((imageHash, idx) => ({
          image_hash: imageHash,
          link: `https://m.me/${pageId}`,
          name: idx === 0 ? copyVariation.headline : `${copyVariation.headline} (${idx + 1})`,
          description: idx === 0 ? copyVariation.primaryText : '',
          call_to_action: {
            type: 'MESSAGE_PAGE',
          },
        }));

        const creativePayload = {
          name: `Creative - ${aiAnalysis.productCategory} - Ad ${i + 1} - Album`,
          object_story_spec: {
            page_id: pageId,
            link_data: {
              link: `https://m.me/${pageId}`,
              message: copyVariation.primaryText,
              child_attachments: childAttachments,
              multi_share_optimized: false,
              call_to_action: {
                type: 'MESSAGE_PAGE',
              },
            },
          },
          access_token: accessToken,
        };

        const creativeResponse = await fetch(
          `https://graph.facebook.com/v22.0/act_${adAccountId}/adcreatives`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(creativePayload),
          }
        );

        const creativeData = await creativeResponse.json();

        if (!creativeResponse.ok || creativeData.error) {
          console.error(`Creative ${i + 1} creation failed:`, creativeData);
          return NextResponse.json(
            { error: `Creative ${i + 1} creation failed: ${creativeData.error?.message}` },
            { status: 400 }
          );
        }

        const adPayload = {
          name: `Ad - ${aiAnalysis.productCategory} - ${new Date().toLocaleDateString('th-TH')} - Album ${i + 1}`,
          adset_id: adSetId,
          creative: { creative_id: creativeData.id },
          status: 'ACTIVE',
          access_token: accessToken,
        };

        const adResponse = await fetch(
          `https://graph.facebook.com/v22.0/act_${adAccountId}/ads`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adPayload),
          }
        );

        const adData = await adResponse.json();

        if (!adResponse.ok || adData.error) {
          console.error(`Ad ${i + 1} creation failed:`, adData);
          return NextResponse.json(
            { error: `Ad ${i + 1} creation failed: ${adData.error?.message}` },
            { status: 400 }
          );
        }

        adIds.push(adData.id);
        console.log(`✓ Ad ${i + 1} created with ${imageMediaIds.length} images (carousel)`);
      }
    }

    // For videos: Create separate ads (1 video per ad)
    if (hasVideos) {
      console.log(`Note: Video ads not yet implemented in multi-media mode`);
      // TODO: Implement video upload to Facebook and create video ads
    }

    console.log(`✓✓✓ Campaign created successfully with ${mediaFiles.length} media files!`);
    console.log(`  - Campaign: ${campaignId}`);
    console.log(`  - AdSets: ${adSetIds.length}`);
    console.log(`  - Ads: ${adIds.length}`);

    // Create Messenger Ice Breakers (conversation starters)
    try {
      console.log('🧊 Creating Messenger ice breakers...');
      const iceBreakerResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/facebook/ice-breakers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            pageId,
            accessToken,
            productCategory: aiAnalysis.productCategory,
          }),
        }
      );

      if (iceBreakerResponse.ok) {
        const iceBreakerData = await iceBreakerResponse.json();
        console.log('✓ Ice breakers created:', iceBreakerData.iceBreakers?.length || 0, 'starters');
      } else {
        console.log('⚠ Ice breakers creation skipped (non-critical)');
      }
    } catch (iceBreakerError) {
      console.log('⚠ Ice breakers creation failed (non-critical):', iceBreakerError);
    }

    // Invalidate all caches for this user
    await invalidateUserCache(session.user.id);

    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      userId: session.user.id,
      action: 'CREATE_CAMPAIGN_MULTI',
      entityId: campaignId,
      details: { mediaCount: mediaFiles.length, adSetCount: adSetIds.length, adsCount: adIds.length },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      campaignId,
      adSetCount: adSetIds.length,
      adsCount: adIds.length,
      mediaCount: mediaFiles.length,
    });
  } catch (error) {
    console.error('Error creating multi-media campaign:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
