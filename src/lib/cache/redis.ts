/**
 * Redis Cache Client for Meta API Response Caching
 * 
 * Uses Upstash Redis via Vercel Integrations (Recommended)
 * 
 * Setup via Vercel:
 * 1. Go to Vercel Project Settings → Integrations
 * 2. Add Redis/Upstash integration
 * 3. Env vars will be auto-populated (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
 * 4. Redeploy project
 */

import { Redis } from '@upstash/redis';

const redisRestUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.STORAGE_REDIS_KV_REST_API_URL;
const redisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.STORAGE_REDIS_KV_REST_API_TOKEN;

// Initialize Redis client from Vercel integration env vars
const redis = redisRestUrl && redisRestToken
  ? new Redis({
    url: redisRestUrl,
    token: redisRestToken,
  })
  : null;

// In-memory fallback when Redis not configured (e.g. localhost)
const memoryCache = new Map<string, { value: unknown; expires: number }>();
const MEMORY_TTL_SEC = 120; // 2 min for in-memory fallback

// In-memory SWR when Redis not configured — fast repeat loads without hitting Meta every time
const swrMemoryCache = new Map<string, { value: unknown; timestamp: number }>();

// Log Redis connection status on initialization
if (typeof window === 'undefined') { // Only in server-side
  if (redis) {
    console.log('✅ [Redis Cache] Redis configured successfully');
  } else {
    console.warn('⚠️ [Redis Cache] Redis NOT configured - using in-memory fallback (2 min TTL)');
  }
}

import { MetaQuotaCacheTTL } from '@/lib/meta-quota-config';

/**
 * Cache TTL configurations (in seconds)
 * Uses meta-quota-config for 500+ user scale
 */
export const CacheTTL = {
  CAMPAIGNS_INSIGHTS: MetaQuotaCacheTTL.LISTS,
  CAMPAIGNS_LIST: MetaQuotaCacheTTL.LISTS,
  ADSETS_LIST: MetaQuotaCacheTTL.LISTS,
  ADS_LIST: MetaQuotaCacheTTL.LISTS,
  PAGE_NAMES: MetaQuotaCacheTTL.PROFILE,
  AD_ACCOUNTS: MetaQuotaCacheTTL.TEAM,
  TEAM_CONFIG: MetaQuotaCacheTTL.TEAM,
  DASHBOARD_STATS: MetaQuotaCacheTTL.DASHBOARD,
  TEAM_FACEBOOK_PICTURES: MetaQuotaCacheTTL.PROFILE,
  USER_PREFERENCES: 86400,      // 24 hours - not Meta API
} as const;

/**
 * Generate cache key
 */
export function generateCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * Get cached data
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const data = await redis.get<T>(key);
      if (data) {
        console.log(`[Cache HIT] ${key}`);
        return data;
      }
    } catch (error) {
      console.error(`[Cache Error] Failed to get ${key}:`, error);
    }
    return null;
  }

  const mem = memoryCache.get(key);
  if (mem && mem.expires > Date.now()) {
    return mem.value as T;
  }
  if (mem) memoryCache.delete(key);
  return null;
}

/**
 * Set cache with TTL
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = CacheTTL.CAMPAIGNS_LIST
): Promise<boolean> {
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttl });
      console.log(`[Cache SET] ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error(`[Cache Error] Failed to set ${key}:`, error);
      return false;
    }
  }

  const ttlMs = Math.min(ttl, MEMORY_TTL_SEC) * 1000;
  memoryCache.set(key, { value, expires: Date.now() + ttlMs });
  return true;
}

/**
 * Delete cache key
 */
export async function deleteCache(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.del(key);
    console.log(`[Cache DEL] ${key}`);
    return true;
  } catch (error) {
    console.error(`[Cache Error] Failed to delete ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  if (!redis) return 0;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    await redis.del(...keys);
    console.log(`[Cache DEL Pattern] ${pattern} (${keys.length} keys)`);
    return keys.length;
  } catch (error) {
    console.error(`[Cache Error] Failed to delete pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Check if cache is available
 */
export function isCacheAvailable(): boolean {
  return redis !== null;
}

/**
 * Cache wrapper for functions
 * Automatically handles cache get/set
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try to get from cache first
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch fresh data
  console.log(`[Cache MISS] ${key} - Fetching fresh data`);
  const data = await fetchFn();

  // Store in cache for next time
  await setCache(key, data, ttl);

  return data;
}

/**
 * Stale-While-Revalidate Cache wrapper
 * Returns stale data immediately, refreshes in background
 * This provides instant loading while keeping data fresh
 */
export async function withCacheSWR<T>(
  key: string,
  ttl: number,
  staleTTL: number, // How long to keep stale data (e.g., 1 hour)
  fetchFn: () => Promise<T>
): Promise<{ data: T; isStale: boolean; revalidating: boolean }> {
  if (!redis) {
    // In-memory SWR: return stale immediately, refresh in background — fast like Meta Ads Manager
    const mem = swrMemoryCache.get(key) as { value: T; timestamp: number } | undefined;
    const now = Date.now();
    const ageSec = mem ? (now - mem.timestamp) / 1000 : Infinity;
    const isFresh = ageSec < ttl;
    const isStale = !isFresh && ageSec < staleTTL;
    if (mem && isFresh) {
      return { data: mem.value, isStale: false, revalidating: false };
    }
    if (mem && isStale) {
      refreshInBackgroundMemory(key, fetchFn, staleTTL);
      return { data: mem.value, isStale: true, revalidating: true };
    }
    const data = await fetchFn();
    swrMemoryCache.set(key, { value: data, timestamp: now });
    return { data, isStale: false, revalidating: false };
  }

  const metaKey = `${key}:meta`;

  try {
    // Try to get cached data and metadata
    const [cached, meta] = await Promise.all([
      redis.get<T>(key),
      redis.get<{ timestamp: number }>(metaKey)
    ]);

    const now = Date.now();
    const cacheAge = meta ? (now - meta.timestamp) / 1000 : Infinity;
    const isFresh = cacheAge < ttl;
    const isStale = !isFresh && cacheAge < staleTTL;

    // Case 1: Fresh cache - return immediately
    if (cached !== null && isFresh) {
      console.log(`[Cache HIT] ${key} (fresh, age: ${Math.round(cacheAge)}s)`);
      return { data: cached, isStale: false, revalidating: false };
    }

    // Case 2: Stale cache exists - return stale data, trigger background refresh
    if (cached !== null && isStale) {
      console.log(`[Cache STALE] ${key} (age: ${Math.round(cacheAge)}s) - Background refresh triggered`);

      // Trigger background refresh (don't await)
      refreshInBackground(key, metaKey, ttl, staleTTL, fetchFn);

      return { data: cached, isStale: true, revalidating: true };
    }

    // Case 3: No cache or too old - must fetch fresh
    console.log(`[Cache MISS] ${key} - Fetching fresh data`);
    const data = await fetchFn();

    // Store with metadata
    await Promise.all([
      redis.set(key, data, { ex: staleTTL }),
      redis.set(metaKey, { timestamp: now }, { ex: staleTTL })
    ]);

    return { data, isStale: false, revalidating: false };
  } catch (error) {
    console.error(`[Cache SWR Error] ${key}:`, error);
    // Fallback to direct fetch on error
    const data = await fetchFn();
    return { data, isStale: false, revalidating: false };
  }
}

// Background refresh for in-memory SWR (fire-and-forget)
function refreshInBackgroundMemory<T>(key: string, fetchFn: () => Promise<T>, staleTTL: number): void {
  fetchFn()
    .then((data) => {
      swrMemoryCache.set(key, { value: data, timestamp: Date.now() });
      console.log(`[Cache MEMORY REFRESH] ${key}`);
    })
    .catch((err) => console.error(`[Cache MEMORY REFRESH Error] ${key}:`, err));
}

// Background refresh function (fire-and-forget)
async function refreshInBackground<T>(
  key: string,
  metaKey: string,
  ttl: number,
  staleTTL: number,
  fetchFn: () => Promise<T>
): Promise<void> {
  try {
    const data = await fetchFn();
    const now = Date.now();

    if (redis) {
      await Promise.all([
        redis.set(key, data, { ex: staleTTL }),
        redis.set(metaKey, { timestamp: now }, { ex: staleTTL })
      ]);
      console.log(`[Cache REFRESH] ${key} - Background refresh complete`);
    }
  } catch (error) {
    console.error(`[Cache REFRESH Error] ${key}:`, error);
  }
}

/**
 * Batch cache operations
 */
export async function batchSetCache<T>(
  entries: Array<{ key: string; value: T; ttl?: number }>
): Promise<void> {
  if (!redis) return;

  try {
    // Use pipeline for better performance
    const pipeline = redis.pipeline();

    for (const entry of entries) {
      pipeline.set(entry.key, entry.value, { ex: entry.ttl || CacheTTL.CAMPAIGNS_LIST });
    }

    await pipeline.exec();
    console.log(`[Cache BATCH SET] ${entries.length} keys`);
  } catch (error) {
    console.error('[Cache Error] Batch set failed:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(pattern: string = '*'): Promise<{
  totalKeys: number;
  pattern: string;
}> {
  if (!redis) {
    return { totalKeys: 0, pattern };
  }

  try {
    const keys = await redis.keys(pattern);
    return {
      totalKeys: keys.length,
      pattern,
    };
  } catch (error) {
    console.error('[Cache Error] Failed to get stats:', error);
    return { totalKeys: 0, pattern };
  }
}

/**
 * Invalidate all caches for a specific user
 * Pattern: meta:*:{userId}:* and dashboard:stats:{userId}:*
 */
export async function invalidateUserCache(userId: string): Promise<number> {
  const metaCount = await deleteCachePattern(`meta:*:*${userId}*`);
  const dashboardCount = await deleteCachePattern(`dashboard:stats:${userId}*`);
  return metaCount + dashboardCount;
}

export default redis;
