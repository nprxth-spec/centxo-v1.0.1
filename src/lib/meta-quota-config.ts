/**
 * Meta API Quota Configuration
 * Centralized config for scaling to 500+ users and 10k+ accounts/pages
 * @see docs/META_QUOTA_500_USERS.md, docs/META_API_USAGE_AND_SCALE.md
 */

export type QuotaScale = '200' | '500' | '1000';

const scale = (process.env.META_QUOTA_SCALE || '500') as QuotaScale;

/** Max ad accounts per single API request (dashboard, campaigns, ads, adsets). Reduces burst and supports 10k+ total accounts by processing in chunks. */
export const MAX_ACCOUNTS_PER_REQUEST = 100;

/**
 * Cache TTL in seconds by scale
 */
export const MetaQuotaCacheTTL = {
  /** team/config, team/ad-accounts — accounts, pages, businesses */
  TEAM: scale === '1000' ? 14400 : scale === '500' ? 10800 : 7200, // 4h / 3h / 2h
  /** dashboard/stats, campaigns, adsets, ads */
  LISTS: scale === '1000' ? 900 : scale === '500' ? 600 : 300, // 15m / 10m / 5m
  /** PAGE_NAMES, facebook-pictures */
  PROFILE: scale === '1000' ? 10800 : scale === '500' ? 7200 : 3600, // 3h / 2h / 1h
  /** dashboard stats specifically */
  DASHBOARD: scale === '1000' ? 900 : scale === '500' ? 900 : 600, // 15m / 15m / 10m
} as const;

/**
 * Client-side durations (ms)
 */
export const MetaQuotaClient = {
  /** AdAccountContext cache duration */
  CACHE_DURATION_MS: scale === '1000' ? 4 * 60 * 60 * 1000 : scale === '500' ? 3 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000,
  /** Manual refresh cooldown (AdAccountContext) */
  REFRESH_COOLDOWN_MS: scale === '1000' ? 20 * 60 * 1000 : scale === '500' ? 15 * 60 * 1000 : 10 * 60 * 1000,
  /** Campaigns page: refresh button cooldown */
  CAMPAIGNS_REFRESH_COOLDOWN_MS: scale === '1000' ? 10 * 60 * 1000 : scale === '500' ? 10 * 60 * 1000 : 5 * 60 * 1000, // 10m / 10m / 5m
  /** Campaigns page: polling interval for real-time updates */
  POLL_INTERVAL_MS: scale === '1000' ? 90000 : scale === '500' ? 60000 : 15000, // 90s / 60s / 15s
} as const;

/**
 * API-side delays (ms)
 */
export const MetaQuotaDelays = {
  /** Delay between account chunks in campaigns/adsets/ads */
  CHUNK_DELAY_MS: scale === '1000' ? 150 : scale === '500' ? 150 : 100,
  /** Export google sheets - delay between batches */
  EXPORT_BATCH_DELAY_MS: scale === '1000' ? 300 : scale === '500' ? 250 : 200,
} as const;

/**
 * 429 retry backoff (ms)
 */
export const MetaQuotaRetry = {
  INITIAL_MS: 2500,
  MAX_MS: 15000,
  MULTIPLIER: 2,
} as const;
