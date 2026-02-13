/**
 * Plan Limits Configuration
 * Re-exports from centralized plans.ts for backward compatibility
 * @see src/lib/plans.ts - Single Source of Truth
 * @see docs/SCALE_200_USERS_HEAVY_ACCOUNTS.md
 */

import {
  PLANS,
  getPlanLimits as _getPlanLimits,
  getAdAccountLimit as _getAdAccountLimit,
  getPageLimit as _getPageLimit,
  getTeamMemberLimit as _getTeamMemberLimit,
  getFacebookAccountLimit as _getFacebookAccountLimit,
  getApiAccountCap as _getApiAccountCap,
  getLiteModeThreshold as _getLiteModeThreshold,
  type PlanId,
  type PlanLimits,
} from './plans';

// Re-export types
export type PlanName = PlanId;
export type { PlanLimits };

// Build PLAN_LIMITS from centralized PLANS for backward compatibility
export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE: PLANS.FREE.limits,
  PLUS: PLANS.PLUS.limits,
  PRO: PLANS.PRO.limits,
};

/** Default when plan unknown */
const DEFAULT_LIMITS: PlanLimits = PLAN_LIMITS.FREE;

/**
 * Get limits for a plan
 */
export function getPlanLimits(plan: string): PlanLimits {
  return _getPlanLimits(plan);
}

/**
 * Get ad account limit for selection/UI
 */
export function getAdAccountLimit(plan: string): number {
  return _getAdAccountLimit(plan);
}

/**
 * Get page limit for selection/UI
 */
export function getPageLimit(plan: string): number {
  return _getPageLimit(plan);
}

/**
 * Get team member limit (max members user can add)
 */
export function getTeamMemberLimit(plan: string): number {
  return _getTeamMemberLimit(plan);
}

/**
 * Get Facebook account limit (Connections - Add Account)
 */
export function getFacebookAccountLimit(plan: string): number {
  return _getFacebookAccountLimit(plan);
}

/**
 * Get API account cap - max accounts per request (hard cap)
 */
export function getApiAccountCap(plan: string): number {
  return _getApiAccountCap(plan);
}

/**
 * Threshold above which to use lite mode (fewer Meta calls)
 */
export function getLiteModeThreshold(plan: string): number {
  return _getLiteModeThreshold(plan);
}

/**
 * Dynamic chunk size based on account count (supports 10k+ accounts)
 * More accounts = smaller chunks to avoid rate limit
 */
export function getDynamicChunkSize(accountCount: number): number {
  if (accountCount > 1000) return 2;
  if (accountCount > 500) return 3;
  if (accountCount > 100) return 4;
  if (accountCount > 50) return 5;
  if (accountCount > 20) return 8;
  return 10;
}

/**
 * Dynamic delay (ms) between chunks based on account count (supports 10k+ accounts)
 */
export function getDynamicChunkDelayMs(accountCount: number): number {
  if (accountCount > 1000) return 400;
  if (accountCount > 500) return 300;
  if (accountCount > 100) return 250;
  if (accountCount > 50) return 200;
  if (accountCount > 20) return 150;
  return 100;
}
