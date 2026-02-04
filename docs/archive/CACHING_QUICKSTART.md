# Quick Start Guide: Implementing Caching

## Step 1: Install Dependencies (2 minutes)

```bash
npm install @upstash/redis
```

## Step 2: Setup Upstash Redis (5 minutes)

1. Go to https://console.upstash.com/
2. Sign up (free tier available)
3. Create a new database
   - Name: `meta-ads-cache`
   - Region: Choose closest to your users
   - Type: Regional (free)
4. Copy credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## Step 3: Add Environment Variables

Add to `.env.local`:

```env
# Upstash Redis
UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

Add to `.env.example`:

```env
# Upstash Redis (for caching Meta API responses)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Step 4: Apply Caching to APIs

### For Campaigns API

Replace `src/app/api/campaigns/route.ts` with the pattern from `EXAMPLE_campaigns_with_cache.ts`

Key changes:
1. Import cache functions
2. Wrap fetch logic in `withCache()`
3. Add cache invalidation on POST

### For Ad Sets API

```typescript
import { withCache, generateCacheKey, CacheTTL } from '@/lib/cache/redis';

// In GET handler:
const cacheKey = generateCacheKey('meta:adsets', session.user.id!, adAccountIds.join(','));

const adSets = await withCache(
  cacheKey,
  CacheTTL.ADSETS_LIST, // 5 minutes
  async () => {
    return await fetchAdSetsFromMeta(adAccountIds, accessToken);
  }
);
```

### For Ads API (with Page Name Caching)

```typescript
// Cache page names separately (longer TTL)
const pageNamesCacheKey = generateCacheKey('meta:pages', pageIds.join(','));

const pageNames = await withCache(
  pageNamesCacheKey,
  CacheTTL.PAGE_NAMES, // 1 hour
  async () => {
    return await fetchPageNames(pageIds, accessToken);
  }
);
```

## Step 5: Add Cache Refresh Button (Frontend)

Update `src/app/(app)/campaigns/page.tsx`:

```typescript
// Add refresh with cache bypass
const handleRefreshWithBypass = async () => {
  setLoading(true);
  
  const adAccountIds = selectedAccounts.map(a => a.id).join(',');
  const response = await fetch(
    `/api/campaigns?adAccountId=${adAccountIds}&refresh=true` // ← force bypass
  );
  
  // ... rest of fetch logic
};

// In UI:
<Button onClick={handleRefreshWithBypass}>
  <RefreshCw className="h-4 w-4 mr-2" />
  Force Refresh
</Button>
```

## Step 6: Test Caching

### Test 1: First Load (Cache Miss)
```bash
# Watch browser console or server logs
# Should see: [Cache MISS] meta:campaigns:userId:accountIds - Fetching fresh data
```

### Test 2: Second Load (Cache Hit)
```bash
# Refresh page within 15 minutes
# Should see: [Cache HIT] meta:campaigns:userId:accountIds
# Page loads instantly without Meta API calls
```

### Test 3: Force Refresh
```bash
# Click force refresh button
# Should see: [Cache DEL] meta:campaigns:userId:accountIds
# Then: [Cache MISS] and fresh data fetched
```

## Step 7: Monitor Cache Performance

Add monitoring endpoint `src/app/api/cache/stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/cache/redis';

export async function GET(request: NextRequest) {
  const stats = await getCacheStats('meta:*');
  
  return NextResponse.json({
    totalKeys: stats.totalKeys,
    patterns: {
      campaigns: await getCacheStats('meta:campaigns:*'),
      adsets: await getCacheStats('meta:adsets:*'),
      ads: await getCacheStats('meta:ads:*'),
      pages: await getCacheStats('meta:pages:*'),
    }
  });
}
```

Access at: `http://localhost:3000/api/cache/stats`

## Expected Performance Improvements

### Before Caching:
- **First user load**: 32 Meta API calls
- **Second user load**: 32 Meta API calls (same data!)
- **10 users refreshing**: 320 API calls
- **50 users**: 1,600 API calls ❌ RATE LIMITED

### After Caching:
- **First user load**: 32 Meta API calls → Cache stored
- **Second user load**: 0 API calls ✅ From cache
- **10 users refreshing**: 32 API calls (first user only)
- **50 users**: 32 API calls ✅ 98% reduction

## Cache Invalidation Strategy

### Auto-Invalidate When:
1. **User creates campaign** → Clear campaigns cache
2. **User updates ad set** → Clear adsets cache
3. **User deletes ad** → Clear ads cache

Example in create campaign API:

```typescript
// After successful campaign creation:
import { deleteCache, generateCacheKey } from '@/lib/cache/redis';

const cacheKey = generateCacheKey('meta:campaigns', userId, adAccountIds.join(','));
await deleteCache(cacheKey);
```

## Troubleshooting

### Issue: Cache not working
```typescript
// Check if Redis is configured
import { isCacheAvailable } from '@/lib/cache/redis';

if (!isCacheAvailable()) {
  console.error('Redis not configured - check environment variables');
}
```

### Issue: Stale data
- Reduce TTL in `CacheTTL` constants
- Add force refresh button
- Implement WebSocket for real-time updates

### Issue: Memory usage
- Upstash free tier: 10K requests/day
- Monitor usage at: https://console.upstash.com/
- Upgrade to Pay-as-you-go if needed ($0.2 per 100K requests)

## Next Steps

After implementing basic caching:

1. **Add pagination** (see SCALABILITY_ANALYSIS.md)
2. **Implement background jobs** for large data fetches
3. **Add WebSocket** for real-time updates
4. **Monitor cache hit rate** and adjust TTLs

## Production Checklist

- [ ] Upstash Redis configured
- [ ] Environment variables set
- [ ] Campaigns API cached
- [ ] Ad Sets API cached
- [ ] Ads API cached
- [ ] Page names cached
- [ ] Cache invalidation on mutations
- [ ] Force refresh button added
- [ ] Monitoring endpoint deployed
- [ ] Tested with 10+ concurrent users
- [ ] Cache hit rate > 85%

## Cost Estimate

**50 users, 500 accounts, 5000 ads:**

### Without Caching:
- API calls: ~1,600 per 5 minutes
- Meta API rate limits: ❌ EXCEEDED
- Cost: N/A (won't work)

### With Caching (15 min TTL):
- API calls: ~32 per 15 minutes = 128/hour
- Cache requests: ~10,000/day
- Upstash cost: **$0** (free tier)
- Meta API: ✅ Within limits

### With Heavy Usage:
- Cache requests: ~100,000/day
- Upstash cost: **~$20/month**
- Still way cheaper than rate limit errors!
