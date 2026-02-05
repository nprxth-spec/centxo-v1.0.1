/**
 * Plan Limits Configuration
 * Limits per subscription plan: ad accounts, pages, team members
 * @see docs/SCALE_200_USERS_HEAVY_ACCOUNTS.md
 */

export type PlanName = 'FREE' | 'PLUS' | 'PRO';

export interface PlanLimits {
  /** Max ad accounts user can select/use at once */
  adAccounts: number;
  /** Max pages user can select/use at once */
  pages: number;
  /** Max team members (additional users) - owner excluded */
  teamMembers: number;
  /** Max Facebook accounts in Connections (Add Account) - FREE 2, PLUS 4, PRO 10 */
  facebookAccounts: number;
  /** Soft cap: warn when exceeding (for API requests, use lower of plan vs softCap) */
  apiAccountCap: number;
  /** Auto lite mode when selected accounts > this (skip insights for faster load) */
  liteModeThreshold: number;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE: {
    adAccounts: 10,
    pages: 5,
    teamMembers: 0,
    facebookAccounts: 2,
    apiAccountCap: 10,
    liteModeThreshold: 10,
  },
  PLUS: {
    adAccounts: 20,
    pages: 15,
    teamMembers: 3,
    facebookAccounts: 4,
    apiAccountCap: 20,
    liteModeThreshold: 20,
  },
  PRO: {
    adAccounts: 50,
    pages: 30,
    teamMembers: 10,
    facebookAccounts: 10,
    apiAccountCap: 50,
    liteModeThreshold: 30,
  },
};

/** Default when plan unknown */
const DEFAULT_LIMITS: PlanLimits = PLAN_LIMITS.FREE;

/**
 * Get limits for a plan
 */
export function getPlanLimits(plan: string): PlanLimits {
  const p = plan?.toUpperCase() as PlanName;
  return PLAN_LIMITS[p] ?? DEFAULT_LIMITS;
}

/**
 * Get ad account limit for selection/UI
 */
export function getAdAccountLimit(plan: string): number {
  return getPlanLimits(plan).adAccounts;
}

/**
 * Get page limit for selection/UI
 */
export function getPageLimit(plan: string): number {
  return getPlanLimits(plan).pages;
}

/**
 * Get team member limit (max members user can add)
 */
export function getTeamMemberLimit(plan: string): number {
  return getPlanLimits(plan).teamMembers;
}

/**
 * Get Facebook account limit (Connections - Add Account)
 */
export function getFacebookAccountLimit(plan: string): number {
  return getPlanLimits(plan).facebookAccounts;
}

/**
 * Get API account cap - max accounts per request (hard cap)
 */
export function getApiAccountCap(plan: string): number {
  return getPlanLimits(plan).apiAccountCap;
}

/**
 * Threshold above which to use lite mode (fewer Meta calls)
 */
export function getLiteModeThreshold(plan: string): number {
  return getPlanLimits(plan).liteModeThreshold;
}

/**
 * Dynamic chunk size based on account count
 * More accounts = smaller chunks to avoid rate limit
 */
export function getDynamicChunkSize(accountCount: number): number {
  if (accountCount > 50) return 5;
  if (accountCount > 20) return 8;
  return 10;
}

/**
 * Dynamic delay (ms) between chunks based on account count
 */
export function getDynamicChunkDelayMs(accountCount: number): number {
  if (accountCount > 50) return 200;
  if (accountCount > 20) return 150;
  return 100;
}
