/**
 * Redis Cache Client for Meta API Response Caching
 * 
 * Install: npm install @upstash/redis
 * 
 * Setup Upstash:
 * 1. Go to https://upstash.com
 * 2. Create free Redis database
 * 3. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * 4. Add to .env.local
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  : null;

/**
 * Cache TTL configurations (in seconds)
 */
export const CacheTTL = {
  CAMPAIGNS_INSIGHTS: 300,      // 5 minutes - auto-refresh after 5 min
  CAMPAIGNS_LIST: 300,          // 5 minutes - list can change
  ADSETS_LIST: 300,             // 5 minutes
  ADS_LIST: 300,                // 5 minutes
  PAGE_NAMES: 3600,             // 1 hour - page names rarely change
  AD_ACCOUNTS: 1800,            // 30 minutes
  USER_PREFERENCES: 86400,      // 24 hours
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
  if (!redis) {
    console.warn('Redis not configured, skipping cache');
    return null;
  }

  try {
    const data = await redis.get<T>(key);
    if (data) {
      console.log(`[Cache HIT] ${key}`);
    }
    return data;
  } catch (error) {
    console.error(`[Cache Error] Failed to get ${key}:`, error);
    return null;
  }
}

/**
 * Set cache with TTL
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = CacheTTL.CAMPAIGNS_LIST
): Promise<boolean> {
  if (!redis) {
    console.warn('Redis not configured, skipping cache set');
    return false;
  }

  try {
    await redis.set(key, value, { ex: ttl });
    console.log(`[Cache SET] ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    console.error(`[Cache Error] Failed to set ${key}:`, error);
    return false;
  }
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
    // No cache available, fetch directly
    const data = await fetchFn();
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
