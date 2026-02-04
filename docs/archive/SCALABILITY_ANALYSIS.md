# Scalability Analysis - Meta Ads Management Platform

## Current System Status

### Architecture
- **Frontend**: Next.js 15.5.9 (App Router, React 19)
- **Database**: MySQL (via Prisma)
- **Authentication**: NextAuth.js
- **Deployment**: Vercel (assumed from apphosting.yaml)

### Target Scale Requirements
- **Users**: 50 concurrent users
- **Ad Accounts**: 500 accounts
- **Ads**: 5,000+ ads
- **Daily Operations**: Campaigns viewing, creation, management

---

## 📊 Critical Bottleneck Analysis

### 1. **Meta Graph API Rate Limits** ⚠️ CRITICAL ISSUE

#### Meta API Limits (Per Access Token)
- **Standard Access**: ~200 calls per hour per user
- **App-level**: 200 calls per hour per user (rolling window)
- **Insights API**: Uses 10x more quota (very expensive)

#### Current Usage Calculation

**Scenario: 50 users, 500 accounts, 5000 ads**

**Per User Load (if each user has 10 accounts avg):**
- Initial page load (Campaigns tab):
  - Campaigns API: 10 accounts ÷ 3 (chunked) = 4 requests
  - Each with insights = 4 requests
  - **Total: 4 requests** (but insights counts 10x = **40 quota points**)

- Switch to Ad Sets tab:
  - 10 accounts ÷ 3 = 4 requests
  - **Total: 4 requests**

- Switch to Ads tab:
  - 10 accounts ÷ 3 = 4 requests
  - Page fetches: ~20 unique pages ÷ 10 = 2 batches = 20 requests
  - **Total: 24 requests**

**Single user full page cycle: ~32 requests (but 40 insights quota points)**

**50 concurrent users refreshing every 5 minutes:**
- **Per 5 minutes**: 50 users × 32 requests = 1,600 requests
- **Per hour**: 1,600 × 12 = **19,200 requests**
- **With insights quota**: 50 users × 40 = **2,000 quota points per 5 min** = **24,000/hour**

**Result: 🔴 WILL FAIL - Exceeds Meta API limits by 100x+**

---

### 2. **Database Capacity** ✅ ACCEPTABLE

**Prisma + MySQL:**
- Can handle 50 concurrent connections easily
- User metadata, sessions: ~500 KB per user = 25 MB
- **Status**: ✅ No issues expected

---

### 3. **In-Memory Rate Limiter** ⚠️ MODERATE ISSUE

**Current Implementation:**
```typescript
// Uses Map() in memory - single instance
private requests: Map<string, number[]> = new Map();
```

**Issues:**
- **Serverless Functions**: Each function instance has separate memory
- **No Shared State**: Rate limits don't work across instances
- **Memory Leak Risk**: With 500 accounts × 50 users = 25K tracking entries

**Status**: ⚠️ Will fail in distributed environment

---

### 4. **Server-Side Rendering Load** ⚠️ MODERATE ISSUE

**Vercel Limits:**
- Function timeout: 10 seconds (Hobby), 60s (Pro)
- Memory: 1024 MB (Hobby), 3008 MB (Pro)
- With current chunking + delays:
  - 500 accounts ÷ 3 per chunk × 200ms delay = **33+ seconds**
  
**Status**: ⚠️ Will timeout on Hobby plan

---

## 🛠️ REQUIRED FIXES for Production Scale

### Priority 1: Caching Layer (CRITICAL) 🔴

**Problem**: Every page load hits Meta API directly

**Solution**: Implement Redis/Upstash Cache

```typescript
// Cache Strategy:
// - Campaign insights: 15 minutes
// - Ad Sets/Ads list: 5 minutes
// - Page names: 1 hour (rarely change)

Key: `meta:campaigns:${accountId}:${userId}`
TTL: 900 seconds (15 minutes)
```

**Implementation:**
```bash
npm install @upstash/redis ioredis
```

**Expected Impact:**
- **API calls reduction**: 95%+ (most traffic hits cache)
- **50 users scenario**: 
  - First load: 1,600 API calls
  - Cache hits: 1,520 requests saved
  - Only 80 cache misses per cycle

---

### Priority 2: Background Job Queue 🔴

**Problem**: Real-time fetching causes timeouts

**Solution**: Bull Queue + Redis

```typescript
// User requests data → Job queued → Worker fetches → Cache updated
// Frontend polls cache or uses WebSocket for updates

Queue: 'fetch-campaigns'
Jobs: {
  accountIds: string[],
  userId: string,
  priority: 'high' | 'normal'
}
```

**Benefits:**
- No function timeouts
- Rate limiting at job level
- Retry failed requests
- Priority queue for active users

---

### Priority 3: Meta API Optimization 🟡

#### 3A. Batch Insights Fetching

**Current**: Each campaign = 1 insights request
**Optimized**: Batch up to 50 campaigns per insights request

```typescript
// Instead of:
/campaigns?fields=insights{...}  // Per campaign

// Use:
/insights?ids=campaign1,campaign2,...campaign50&fields=spend,actions
```

**Impact**: Reduce insights calls by 50x

#### 3B. Field Selection Optimization

**Current**: Fetching all fields
**Optimized**: Only fetch needed fields

```typescript
// Before: 
fields=id,name,status,objective,daily_budget,created_time,insights.date_preset(last_30d){spend,actions,cost_per_action_type,reach,impressions,clicks}

// After (for list view):
fields=id,name,status,daily_budget,insights{spend,actions{action_type,value}}
// Fetch detailed insights only on-demand
```

---

### Priority 4: Distributed Rate Limiting 🟡

**Replace in-memory Map with Redis:**

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
  
  const count = await redis.incr(windowKey);
  await redis.expire(windowKey, Math.ceil(windowMs / 1000));
  
  return count <= maxRequests;
}
```

---

### Priority 5: Pagination & Lazy Loading 🟢

**Current**: Load all accounts/ads at once
**Optimized**: Implement pagination

```typescript
// API Routes:
GET /api/campaigns?page=1&limit=50&adAccountId=xxx

// Frontend: Infinite scroll or pagination
// Only load visible data
```

**Benefits:**
- Initial load: 50 ads instead of 5000
- Reduce API calls by 99%

---

### Priority 6: WebSocket for Real-time Updates 🟢

**Instead of polling every 5 minutes:**

```typescript
// Server pushes updates when cache refreshes
// Client subscribes to relevant channels

const socket = io();
socket.on('campaigns:updated', (data) => {
  updateCampaignsState(data);
});
```

---

## 📈 Estimated Costs & Resources

### Required Services

1. **Upstash Redis** (Recommended for Serverless)
   - Free tier: 10K requests/day
   - Pay-as-you-go: $0.2 per 100K requests
   - **Estimated**: ~$50-100/month for 50 users

2. **Vercel Pro** (Required)
   - $20/month per user
   - Higher limits:
     - 60s timeout
     - 3GB memory
     - Unlimited bandwidth
   - **Estimated**: $20/month

3. **Meta API Business Verification**
   - Free but requires approval
   - Increases rate limits to ~4800 calls/hour
   - **Required** for 50+ users

### Alternative: Self-Hosted (Cost Effective)

**DigitalOcean/AWS:**
- VPS: $40-80/month (4GB RAM, 2 vCPU)
- Redis: Managed service $15/month or self-hosted
- PostgreSQL: Managed $15/month
- **Total**: ~$70-110/month (no per-user cost)

**Benefits:**
- No function timeouts
- Dedicated Redis
- Full control
- Better for background jobs

---

## 🎯 Recommended Implementation Plan

### Phase 1: Immediate Fixes (Week 1)
✅ Implement Upstash Redis caching
✅ Add pagination to ad lists (50 per page)
✅ Optimize Meta API field selection
✅ Deploy to Vercel Pro

**Expected Result**: 
- Support 10-15 concurrent users
- 90% reduction in API calls
- No timeouts

### Phase 2: Scaling (Week 2-3)
✅ Implement Bull Queue for background jobs
✅ Add distributed rate limiting with Redis
✅ Batch insights API calls
✅ Add WebSocket for real-time updates

**Expected Result**:
- Support 30-50 concurrent users
- 99% reduction in API calls
- Real-time updates without polling

### Phase 3: Production Ready (Week 4)
✅ Meta Business Verification
✅ Add monitoring (Sentry, DataDog)
✅ Load testing
✅ CDN for static assets
✅ Database connection pooling

**Expected Result**:
- Production-ready for 50+ users
- 500 ad accounts
- 5000+ ads
- SLA monitoring

---

## 📊 Performance Metrics Comparison

| Metric | Current | After Phase 1 | After Phase 2 | Target |
|--------|---------|---------------|---------------|--------|
| Max Concurrent Users | 2-3 | 10-15 | 30-50 | 50 |
| API Calls/Hour | 19,200 | 1,920 | 192 | <200 |
| Page Load Time | 5-10s | 1-2s | 0.5-1s | <2s |
| Cache Hit Rate | 0% | 85% | 95% | >90% |
| Function Timeouts | 100% | 10% | 0% | <1% |

---

## 🚨 Critical Warnings

### ⚠️ DO NOT go to production without:
1. **Redis Cache** - Will hit rate limits immediately
2. **Vercel Pro Plan** - Functions will timeout
3. **Pagination** - Will crash with 5000+ ads
4. **Meta Business Verification** - API limits too low

### ⚠️ Known Issues to Fix:
1. **Page API calls not batched** - Each ad = 1 API call
2. **No retry logic** - Failed requests = data loss  
3. **No monitoring** - Can't detect issues
4. **In-memory rate limiter** - Doesn't work in serverless

---

## 💰 Cost Summary (Monthly)

### Development/Testing (5 users)
- Vercel Hobby: Free
- Upstash Free: Free
- **Total**: $0

### Small Production (10-20 users)
- Vercel Pro: $20
- Upstash: $10-20
- **Total**: $30-40/month

### Target Scale (50 users)
- Vercel Pro: $20
- Upstash Pro: $50-100
- Monitoring: $20-50
- **Total**: $90-170/month

### Enterprise Alternative (Self-Hosted)
- VPS: $80
- Redis: $15
- DB: $15
- **Total**: $110/month (better value at scale)

---

## Next Steps

1. ✅ Review this analysis
2. ⚠️ Choose deployment strategy (Serverless vs Self-hosted)
3. ⚠️ Set up Upstash Redis (takes 5 minutes)
4. ⚠️ Implement caching layer (Priority 1)
5. ⚠️ Test with 10 users before scaling
