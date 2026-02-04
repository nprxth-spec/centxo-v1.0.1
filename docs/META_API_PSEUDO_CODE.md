# Meta API Pseudo-Code & Sequence

## Campaign Launch Sequence (Detailed)

### High-Level Flow
```
1. Validate User & Input
2. Upload Video to Meta
3. Create Campaign (PAUSED)
4. Create AdSet with Targeting
5. Generate N Ad Copies with AI
6. Create N Ad Creatives
7. Create N Ads
8. Activate Everything
9. Save to Database
10. Log Audit Trail
```

---

## Detailed Pseudo-Code

### 1. POST /api/launch - Main Handler

```typescript
async function launchCampaign(request) {
  // ============================================
  // STEP 1: Authentication & Validation
  // ============================================
  
  session = await getServerSession()
  if (!session || !session.user) {
    return error(401, "Unauthorized")
  }
  
  // Parse input
  const {
    videoPath,
    pageId,
    numberOfAds,
    campaignName,
    dailyBudget = 20,
    productContext
  } = await request.json()
  
  // Validate input
  if (!videoPath || !pageId || !numberOfAds) {
    return error(400, "Missing required fields")
  }
  
  if (numberOfAds < 1 || numberOfAds > 10) {
    return error(400, "numberOfAds must be between 1-10")
  }
  
  
  // ============================================
  // STEP 2: Get User's Meta Account
  // ============================================
  
  user = await db.findUser({
    email: session.user.email,
    include: { metaAccount: true }
  })
  
  if (!user.metaAccount) {
    return error(400, "Meta account not connected")
  }
  
  if (!user.metaAccount.adAccountId) {
    return error(400, "Ad account not selected")
  }
  
  // Decrypt access token
  accessToken = decryptToken(user.metaAccount.accessToken)
  adAccountId = user.metaAccount.adAccountId
  metaClient = new MetaAPIClient(accessToken)
  
  
  // ============================================
  // STEP 3: Upload Video to Meta
  // ============================================
  
  console.log("Uploading video to Meta...")
  
  try {
    videoUploadResponse = await metaClient.uploadVideo(
      adAccountId,
      videoPath,
      `Video-${Date.now()}`
    )
    videoAssetId = videoUploadResponse.id
  } catch (error) {
    return error(500, `Video upload failed: ${error.message}`)
  }
  
  
  // ============================================
  // STEP 4: Create Campaign
  // ============================================
  
  finalCampaignName = campaignName || `Messages Campaign ${new Date()}`
  console.log(`Creating campaign: ${finalCampaignName}`)
  
  try {
    campaignResponse = await metaClient.createCampaign(
      adAccountId,
      finalCampaignName,
      objective: "MESSAGES",
      status: "PAUSED"  // Start paused
    )
    metaCampaignId = campaignResponse.id
  } catch (error) {
    return error(500, `Campaign creation failed: ${error.message}`)
  }
  
  // Save campaign to database
  campaign = await db.createCampaign({
    metaCampaignId,
    name: finalCampaignName,
    objective: "MESSAGES",
    status: "PAUSED",
    dailyBudget,
    videoPath,
    videoAssetId,
    metaAccountId: user.metaAccount.id
  })
  
  
  // ============================================
  // STEP 5: Create Ad Set
  // ============================================
  
  console.log("Creating ad set...")
  
  // Build targeting for Thailand
  targeting = {
    geo_locations: {
      countries: ["TH"]  // Thailand
    },
    age_min: 20,
    locales: [22, 6],  // Thai (22), English (6)
    publisher_platforms: ["facebook", "instagram", "messenger"],
    facebook_positions: ["feed", "story", "video_feeds", "marketplace"],
    instagram_positions: ["stream", "story", "explore"],
    messenger_positions: ["messenger_home", "story"],
    device_platforms: ["mobile", "desktop"]
  }
  
  try {
    adSetResponse = await metaClient.createAdSet({
      campaignId: metaCampaignId,
      name: `AdSet - ${finalCampaignName}`,
      dailyBudget: dailyBudget * 100,  // Convert USD to cents
      targeting: targeting,
      bidStrategy: "LOWEST_COST_WITHOUT_CAP",
      optimizationGoal: "CONVERSATIONS",
      billingEvent: "IMPRESSIONS",
      status: "PAUSED",
      pageId: pageId  // Required for Messages objective
    })
    metaAdSetId = adSetResponse.id
  } catch (error) {
    // Rollback: delete campaign if ad set fails
    await metaClient.updateCampaignStatus(metaCampaignId, "ARCHIVED")
    return error(500, `Ad set creation failed: ${error.message}`)
  }
  
  // Save ad set to database
  adSet = await db.createAdSet({
    metaAdSetId,
    campaignId: campaign.id,
    status: "PAUSED",
    targeting: targeting,
    dailyBudget
  })
  
  
  // ============================================
  // STEP 6: Generate Ad Copies with AI
  // ============================================
  
  console.log(`Generating ${numberOfAds} ad copy variations...`)
  
  try {
    adCopies = await aiCopyService.generateAdCopies({
      productContext: productContext || "general product or service",
      tone: "friendly",
      numberOfVariations: numberOfAds
    })
  } catch (error) {
    console.error("AI generation failed, using fallback copies")
    adCopies = getFallbackCopies(numberOfAds)
  }
  
  // Validate generated copies
  for (copy in adCopies) {
    validation = validateAdCopy(copy)
    if (!validation.valid) {
      console.warn(`Copy validation failed: ${validation.errors}`)
      // Use fallback for invalid copy
      adCopies[index] = getFallbackCopies(1)[0]
    }
  }
  
  
  // ============================================
  // STEP 7: Create Ads (N iterations)
  // ============================================
  
  console.log("Creating ads...")
  createdAds = []
  
  for (i = 0; i < numberOfAds; i++) {
    copy = adCopies[i] || adCopies[0]  // Fallback to first if not enough
    
    // ------------------------------------
    // STEP 7a: Create Ad Creative
    // ------------------------------------
    
    try {
      creativeResponse = await metaClient.createAdCreative({
        adAccountId,
        name: `Creative ${i + 1} - ${finalCampaignName}`,
        pageId,
        videoId: videoAssetId,
        message: `${copy.primaryTextTH}\n\n${copy.primaryTextEN}`,
        link: `https://m.me/${pageId}`
      })
      metaCreativeId = creativeResponse.id
    } catch (error) {
      console.error(`Creative ${i + 1} creation failed: ${error.message}`)
      continue  // Skip this ad and continue with others
    }
    
    // Save creative to database
    creative = await db.createAdCreative({
      metaCreativeId,
      videoAssetId,
      primaryTextTH: copy.primaryTextTH,
      primaryTextEN: copy.primaryTextEN,
      headlineTH: copy.headlineTH,
      headlineEN: copy.headlineEN,
      ctaMessagePromptTH: copy.ctaMessagePromptTH,
      ctaMessagePromptEN: copy.ctaMessagePromptEN
    })
    
    // ------------------------------------
    // STEP 7b: Create Ad
    // ------------------------------------
    
    try {
      adResponse = await metaClient.createAd({
        adSetId: metaAdSetId,
        adAccountId,
        name: `Ad ${i + 1} - ${finalCampaignName}`,
        creativeId: metaCreativeId,
        status: "PAUSED"
      })
      metaAdId = adResponse.id
    } catch (error) {
      console.error(`Ad ${i + 1} creation failed: ${error.message}`)
      continue
    }
    
    // Save ad to database
    ad = await db.createAd({
      metaAdId,
      adSetId: adSet.id,
      status: "PAUSED",
      adCreativeId: creative.id
    })
    
    createdAds.push({
      id: ad.id,
      metaAdId,
      primaryTextTH: copy.primaryTextTH,
      primaryTextEN: copy.primaryTextEN
    })
  }
  
  // Check if at least one ad was created
  if (createdAds.length === 0) {
    // Rollback: archive campaign and ad set
    await metaClient.updateCampaignStatus(metaCampaignId, "ARCHIVED")
    return error(500, "Failed to create any ads")
  }
  
  
  // ============================================
  // STEP 8: Activate Campaign and Ads
  // ============================================
  
  console.log("Activating campaign and ads...")
  
  try {
    // Activate campaign first
    await metaClient.updateCampaignStatus(metaCampaignId, "ACTIVE")
    await db.updateCampaign(campaign.id, { status: "ACTIVE" })
    
    // Then activate all ads
    for (ad in createdAds) {
      await metaClient.updateAdStatus(ad.metaAdId, "ACTIVE")
      await db.updateAd(ad.id, { status: "ACTIVE" })
    }
  } catch (error) {
    return error(500, `Activation failed: ${error.message}`)
  }
  
  
  // ============================================
  // STEP 9: Log Audit Trail
  // ============================================
  
  await db.createAuditLog({
    userId: user.id,
    action: "CREATE_CAMPAIGN",
    entityType: "Campaign",
    entityId: campaign.id,
    campaignId: campaign.id,
    details: {
      numberOfAds: createdAds.length,
      dailyBudget,
      pageId
    },
    ipAddress: request.headers["x-forwarded-for"],
    userAgent: request.headers["user-agent"]
  })
  
  
  // ============================================
  // STEP 10: Return Success Response
  // ============================================
  
  return success(201, {
    success: true,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      metaCampaignId,
      status: "ACTIVE",
      numberOfAds: createdAds.length
    },
    ads: createdAds
  })
}
```

---

## Optimization Sequence (Detailed)

### POST /api/cron/optimize - Main Handler

```typescript
async function optimizeAllCampaigns(request) {
  // ============================================
  // STEP 1: Authentication
  // ============================================
  
  authHeader = request.headers["authorization"]
  cronSecret = process.env.CRON_SECRET
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return error(401, "Unauthorized")
  }
  
  console.log("[CRON] Starting optimization job...")
  startTime = Date.now()
  
  
  // ============================================
  // STEP 2: Get All Active Meta Accounts
  // ============================================
  
  metaAccounts = await db.findMetaAccounts({
    include: {
      campaigns: {
        where: {
          status: ["ACTIVE", "PAUSED"]
        }
      }
    }
  })
  
  console.log(`[CRON] Found ${metaAccounts.length} accounts to optimize`)
  results = []
  
  
  // ============================================
  // STEP 3: Process Each Meta Account
  // ============================================
  
  for (metaAccount in metaAccounts) {
    if (metaAccount.campaigns.length === 0) {
      continue
    }
    
    try {
      // Decrypt token
      accessToken = decryptToken(metaAccount.accessToken)
      metaClient = new MetaAPIClient(accessToken)
      
      // Optimize all campaigns for this account
      accountResults = await optimizeCampaignsForAccount(
        metaAccount,
        metaClient
      )
      
      results.push({
        metaAccountId: metaAccount.id,
        userId: metaAccount.userId,
        campaignsOptimized: accountResults.length,
        results: accountResults
      })
    } catch (error) {
      console.error(`[CRON] Error optimizing account ${metaAccount.id}`)
      results.push({
        metaAccountId: metaAccount.id,
        userId: metaAccount.userId,
        error: error.message
      })
    }
  }
  
  
  // ============================================
  // STEP 4: Return Summary
  // ============================================
  
  endTime = Date.now()
  duration = endTime - startTime
  
  console.log(`[CRON] Completed in ${duration}ms`)
  
  return success(200, {
    success: true,
    timestamp: new Date(),
    duration,
    accountsProcessed: metaAccounts.length,
    results
  })
}


// ============================================
// Sub-function: Optimize Single Campaign
// ============================================

async function optimizeCampaign(campaign, metaClient) {
  actions = []
  
  // Check warmup period (first 3 hours)
  campaignAge = Date.now() - campaign.createdAt
  warmupPeriod = 3 * 60 * 60 * 1000  // 3 hours in ms
  isInWarmup = campaignAge < warmupPeriod
  
  if (isInWarmup) {
    console.log(`Campaign ${campaign.id} in warmup, skipping`)
    return {
      campaignId: campaign.id,
      actions: [],
      summary: `In warmup (${campaignAge / 3600000}h / 3h)`
    }
  }
  
  
  // ============================================
  // Fetch Fresh Insights from Meta
  // ============================================
  
  try {
    campaignInsights = await metaClient.getCampaignInsights(
      campaign.metaCampaignId,
      datePreset: "today"
    )
    
    // Save insights to database
    if (campaignInsights.data.length > 0) {
      insight = campaignInsights.data[0]
      messages = extractMessageCount(insight)
      spend = parseFloat(insight.spend || 0)
      costPerMessage = messages > 0 ? spend / messages : null
      
      await db.upsertCampaignInsight({
        campaignId: campaign.id,
        date: today(),
        spend,
        messages,
        costPerMessage: costPerMessage || 0
      })
    }
  } catch (error) {
    console.error(`Error fetching campaign insights: ${error.message}`)
  }
  
  
  // ============================================
  // Optimize Each Ad
  // ============================================
  
  for (adSet in campaign.adSets) {
    for (ad in adSet.ads) {
      adActions = await optimizeAd(ad, campaign, metaClient, isInWarmup)
      actions.push(...adActions)
    }
  }
  
  
  // ============================================
  // Campaign-Level Rules
  // ============================================
  
  // Rule: If all ads paused, pause campaign
  activeAdsCount = countActiveAds(campaign)
  
  if (activeAdsCount === 0 && campaign.status === "ACTIVE") {
    actions.push({
      entityType: "Campaign",
      entityId: campaign.id,
      action: "PAUSE",
      reason: "All ads are paused",
      metadata: { activeAdsCount: 0 }
    })
  }
  
  
  // ============================================
  // Execute All Actions
  // ============================================
  
  for (action in actions) {
    await executeOptimizationAction(action, metaClient)
  }
  
  summary = generateSummary(actions)
  
  return {
    campaignId: campaign.id,
    actions,
    summary
  }
}


// ============================================
// Sub-function: Optimize Single Ad
// ============================================

async function optimizeAd(ad, campaign, metaClient, isInWarmup) {
  actions = []
  
  // Skip if already paused
  if (ad.status === "PAUSED") {
    return actions
  }
  
  
  // ============================================
  // Fetch Ad Insights from Meta
  // ============================================
  
  try {
    adInsights = await metaClient.getAdInsights(ad.metaAdId, "today")
    
    if (adInsights.data.length === 0) {
      return actions  // No data yet
    }
    
    insight = adInsights.data[0]
    messages = extractMessageCount(insight)
    spend = parseFloat(insight.spend || 0)
    costPerMessage = messages > 0 ? spend / messages : null
    
    // Save insights
    await db.upsertAdInsight({
      adId: ad.id,
      date: today(),
      spend,
      messages,
      costPerMessage: costPerMessage || 0
    })
    
    
    // ============================================
    // RULE 1: Pause if no messages after spending
    // ============================================
    
    MAX_SPEND_NO_MESSAGES = 5  // $5 USD
    
    if (spend >= MAX_SPEND_NO_MESSAGES && messages === 0 && !isInWarmup) {
      actions.push({
        entityType: "Ad",
        entityId: ad.id,
        action: "PAUSE",
        reason: `Spent $${spend} with 0 messages (threshold: $${MAX_SPEND_NO_MESSAGES})`,
        metadata: { spend, messages }
      })
    }
    
    
    // ============================================
    // RULE 2: Pause if cost too high
    // ============================================
    
    if (messages > 0 && !isInWarmup) {
      campaignMedianCPM = await calculateCampaignMedianCPM(campaign.id)
      
      if (campaignMedianCPM && costPerMessage) {
        THRESHOLD_MULTIPLIER = 1.5
        threshold = campaignMedianCPM * THRESHOLD_MULTIPLIER
        
        if (costPerMessage > threshold) {
          actions.push({
            entityType: "Ad",
            entityId: ad.id,
            action: "PAUSE",
            reason: `CPM $${costPerMessage} exceeds threshold $${threshold}`,
            metadata: { costPerMessage, threshold, campaignMedianCPM }
          })
        }
      }
    }
    
    
    // ============================================
    // RULE 3: Mark Winners
    // ============================================
    
    MIN_MESSAGES_FOR_WINNER = 3
    
    if (messages >= MIN_MESSAGES_FOR_WINNER && costPerMessage) {
      campaignAvgCPM = await calculateCampaignAverageCPM(campaign.id)
      
      if (campaignAvgCPM && costPerMessage < campaignAvgCPM && !ad.isWinner) {
        actions.push({
          entityType: "Ad",
          entityId: ad.id,
          action: "MARK_WINNER",
          reason: `Winner: ${messages} msgs at $${costPerMessage} (avg: $${campaignAvgCPM})`,
          metadata: { messages, costPerMessage, campaignAvgCPM }
        })
      }
    }
    
  } catch (error) {
    console.error(`Error optimizing ad ${ad.id}: ${error.message}`)
  }
  
  return actions
}


// ============================================
// Sub-function: Execute Optimization Action
// ============================================

async function executeOptimizationAction(action, metaClient) {
  try {
    if (action.action === "PAUSE") {
      if (action.entityType === "Ad") {
        // Get ad from database
        ad = await db.findAd(action.entityId)
        
        // Update in Meta
        await metaClient.updateAdStatus(ad.metaAdId, "PAUSED")
        
        // Update in database
        await db.updateAd(action.entityId, { status: "PAUSED" })
      }
      else if (action.entityType === "Campaign") {
        campaign = await db.findCampaign(action.entityId)
        await metaClient.updateCampaignStatus(campaign.metaCampaignId, "PAUSED")
        await db.updateCampaign(action.entityId, { status: "PAUSED" })
      }
    }
    else if (action.action === "MARK_WINNER") {
      await db.updateAd(action.entityId, { isWinner: true })
    }
    
    // Log decision
    await db.createDecisionLog({
      entityType: action.entityType,
      entityId: action.entityId,
      action: action.action,
      reason: action.reason,
      metadata: action.metadata || {}
    })
    
  } catch (error) {
    console.error(`Error executing action: ${error.message}`)
  }
}
```

---

## Helper Functions

### Calculate Median Cost Per Message

```typescript
async function calculateCampaignMedianCPM(campaignId) {
  // Get all ad insights with messages > 0
  insights = await db.findAdInsights({
    where: {
      ad: {
        adSet: {
          campaignId: campaignId
        }
      },
      messages: { gt: 0 },
      costPerMessage: { gt: 0 }
    },
    orderBy: {
      costPerMessage: "asc"
    }
  })
  
  if (insights.length === 0) {
    return null
  }
  
  // Calculate median
  mid = floor(insights.length / 2)
  
  if (insights.length % 2 === 0) {
    // Even number of elements
    return (insights[mid - 1].costPerMessage + insights[mid].costPerMessage) / 2
  } else {
    // Odd number of elements
    return insights[mid].costPerMessage
  }
}
```

### Calculate Average Cost Per Message

```typescript
async function calculateCampaignAverageCPM(campaignId) {
  result = await db.aggregateAdInsights({
    where: {
      ad: {
        adSet: {
          campaignId: campaignId
        }
      },
      messages: { gt: 0 },
      costPerMessage: { gt: 0 }
    },
    _avg: {
      costPerMessage: true
    }
  })
  
  return result._avg.costPerMessage
}
```

### Extract Message Count from Meta Insights

```typescript
function extractMessageCount(insight) {
  if (!insight.actions) {
    return 0
  }
  
  // Find the messaging action
  messageAction = insight.actions.find(
    action => action.action_type === "onsite_conversion.messaging_conversation_started_7d"
  )
  
  if (!messageAction) {
    return 0
  }
  
  return parseInt(messageAction.value, 10)
}
```

---

## Error Handling Patterns

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      
      // Check if error is retryable
      if (error.code === "RATE_LIMIT_EXCEEDED" ||
          error.code === "TEMPORARILY_UNAVAILABLE") {
        
        delay = 1000 * Math.pow(2, attempt)  // 2s, 4s, 8s
        console.log(`Retry attempt ${attempt} after ${delay}ms`)
        await sleep(delay)
        continue
      }
      
      // Non-retryable error
      throw error
    }
  }
}
```

### Graceful Degradation

```typescript
async function fetchInsightsWithFallback(metaClient, entityId, entityType) {
  try {
    // Try to fetch from Meta API
    return await metaClient.getInsights(entityId, entityType)
  } catch (error) {
    console.error(`Failed to fetch insights: ${error.message}`)
    
    // Fall back to database (last known data)
    return await db.getLastKnownInsights(entityId, entityType)
  }
}
```

---

## Meta API Response Examples

### Create Campaign Response
```json
{
  "id": "120205123456789",
  "success": true
}
```

### Create Ad Set Response
```json
{
  "id": "120205987654321",
  "success": true
}
```

### Get Insights Response
```json
{
  "data": [
    {
      "campaign_id": "120205123456789",
      "campaign_name": "Summer Sale 2024",
      "spend": "15.50",
      "actions": [
        {
          "action_type": "onsite_conversion.messaging_conversation_started_7d",
          "value": "12"
        }
      ],
      "cost_per_action_type": [
        {
          "action_type": "onsite_conversion.messaging_conversation_started_7d",
          "value": "1.29"
        }
      ]
    }
  ],
  "paging": {
    "cursors": {
      "before": "...",
      "after": "..."
    }
  }
}
```

---

This pseudo-code provides a clear implementation guide for the Meta API integration and optimization logic. All critical paths include error handling and logging for production readiness.
