/**
 * Centralized Plan Configuration
 * Single Source of Truth for all subscription plans
 * 
 * @description This file contains all plan definitions, pricing, limits, and features.
 * All other files should import from here to ensure consistency.
 */

// ============================================================================
// TYPES
// ============================================================================

export type PlanId = 'FREE' | 'PLUS' | 'PRO';
export type Currency = 'USD' | 'THB';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanLimits {
  /** Maximum ad accounts user can select/use */
  adAccounts: number;
  /** Maximum pages user can manage */
  pages: number;
  /** Maximum team members (excluding owner) */
  teamMembers: number;
  /** Maximum Facebook accounts in Connections */
  facebookAccounts: number;
  /** API request cap per batch */
  apiAccountCap: number;
  /** Threshold for lite mode activation */
  liteModeThreshold: number;
  /** AI generations per month (0 = unlimited) */
  aiGenerations: number;
  /** Access to AI features */
  aiAccess: boolean;
}

export interface PlanPricing {
  monthly: number;
  yearly: number;
  /** Original price before discount (for showing strikethrough) */
  originalMonthly?: number;
  originalYearly?: number;
}

export interface PlanFeature {
  /** Translation key for the feature name */
  key: string;
  /** Fallback text if translation not found */
  fallback: string;
  /** Feature highlight (e.g., "NEW", "POPULAR") */
  badge?: string;
  /** Whether this feature is included in the plan */
  included: boolean;
}

export interface Plan {
  id: PlanId;
  /** Translation key for plan name */
  nameKey: string;
  /** Fallback name */
  name: string;
  /** Translation key for plan description */
  descriptionKey: string;
  /** Fallback description */
  description: string;
  /** Pricing in different currencies */
  pricing: Record<Currency, PlanPricing>;
  /** Resource limits */
  limits: PlanLimits;
  /** Plan features list */
  features: PlanFeature[];
  /** Stripe price ID (from env) */
  stripePriceId?: string;
  /** Trial days for new users */
  trialDays: number;
  /** Whether this is the recommended/popular plan */
  recommended?: boolean;
  /** Plan color theme */
  color: string;
  /** Icon name for the plan */
  icon: 'Sparkles' | 'Zap' | 'Crown';
}

// ============================================================================
// PLAN DEFINITIONS
// ============================================================================

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: 'FREE',
    nameKey: 'plans.free.name',
    name: 'Free',
    descriptionKey: 'plans.free.description',
    description: 'Get started with essential features',
    pricing: {
      USD: { monthly: 0, yearly: 0 },
      THB: { monthly: 0, yearly: 0 },
    },
    limits: {
      adAccounts: 5,
      pages: 3,
      teamMembers: 2,
      facebookAccounts: 2,
      apiAccountCap: 5,
      liteModeThreshold: 5,
      aiGenerations: 100,
      aiAccess: true,
    },
    features: [
      { key: 'plans.features.adManagement', fallback: 'Campaign, Ad Set, Ad management', included: true },
      { key: 'plans.features.adAccounts', fallback: '5 Ad Accounts', included: true },
      { key: 'plans.features.pages', fallback: '3 Pages', included: true },
      { key: 'plans.features.teamMembers', fallback: '2 Team Members', included: true },
      { key: 'plans.features.basicAnalytics', fallback: 'Basic analytics', included: true },
      { key: 'plans.features.standardSupport', fallback: 'Email support', included: true },
      { key: 'plans.features.aiOptimization', fallback: 'AI Optimization', included: false },
      { key: 'plans.features.adbox', fallback: 'Adbox (Messenger)', included: false },
      { key: 'plans.features.googleSheets', fallback: 'Google Sheets export', included: false },
    ],
    trialDays: 14,
    color: 'slate',
    icon: 'Sparkles',
  },

  PLUS: {
    id: 'PLUS',
    nameKey: 'plans.plus.name',
    name: 'Plus',
    descriptionKey: 'plans.plus.description',
    description: 'For growing businesses and teams',
    pricing: {
      USD: { monthly: 39, yearly: 390, originalMonthly: 99 },
      THB: { monthly: 1390, yearly: 13900, originalMonthly: 3490 },
    },
    limits: {
      adAccounts: 15,
      pages: 10,
      teamMembers: 5,
      facebookAccounts: 5,
      apiAccountCap: 15,
      liteModeThreshold: 15,
      aiGenerations: 500,
      aiAccess: true,
    },
    features: [
      { key: 'plans.features.everythingInFree', fallback: 'Everything in Free', included: true },
      { key: 'plans.features.adAccounts', fallback: '15 Ad Accounts', included: true },
      { key: 'plans.features.pages', fallback: '10 Pages', included: true },
      { key: 'plans.features.teamMembers', fallback: '5 Team Members', included: true },
      { key: 'plans.features.advancedAnalytics', fallback: 'Advanced analytics', included: true },
      { key: 'plans.features.prioritySupport', fallback: 'Priority support', included: true },
      { key: 'plans.features.aiOptimization', fallback: 'AI Optimization (500/mo)', included: true, badge: 'AI' },
      { key: 'plans.features.adbox', fallback: 'Adbox (Messenger)', included: true, badge: 'NEW' },
      { key: 'plans.features.googleSheets', fallback: 'Google Sheets export', included: true },
    ],
    stripePriceId: process.env.STRIPE_PRICE_ID_PLUS || '',
    trialDays: 0,
    recommended: true,
    color: 'blue',
    icon: 'Zap',
  },

  PRO: {
    id: 'PRO',
    nameKey: 'plans.pro.name',
    name: 'Pro',
    descriptionKey: 'plans.pro.description',
    description: 'For agencies and power users',
    pricing: {
      USD: { monthly: 99, yearly: 990, originalMonthly: 199 },
      THB: { monthly: 3490, yearly: 34900, originalMonthly: 6990 },
    },
    limits: {
      adAccounts: 30,
      pages: 25,
      teamMembers: 10,
      facebookAccounts: 10,
      apiAccountCap: 30,
      liteModeThreshold: 30,
      aiGenerations: 2000,
      aiAccess: true,
    },
    features: [
      { key: 'plans.features.everythingInPlus', fallback: 'Everything in Plus', included: true },
      { key: 'plans.features.adAccounts', fallback: '30 Ad Accounts', included: true },
      { key: 'plans.features.pages', fallback: '25 Pages', included: true },
      { key: 'plans.features.teamMembers', fallback: '10 Team Members', included: true },
      { key: 'plans.features.enterpriseAnalytics', fallback: 'Enterprise analytics', included: true },
      { key: 'plans.features.dedicatedSupport', fallback: 'Dedicated support', included: true },
      { key: 'plans.features.aiOptimization', fallback: 'AI Optimization (2,000/mo)', included: true, badge: 'AI' },
      { key: 'plans.features.adbox', fallback: 'Adbox (Messenger)', included: true },
      { key: 'plans.features.googleSheets', fallback: 'Google Sheets export', included: true },
      { key: 'plans.features.earlyAccess', fallback: 'Early access to new features', included: true, badge: 'BETA' },
    ],
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO || '',
    trialDays: 0,
    color: 'purple',
    icon: 'Crown',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all plans as an array (sorted by price)
 */
export function getAllPlans(): Plan[] {
  return Object.values(PLANS);
}

/**
 * Get a plan by ID
 */
export function getPlan(planId: string): Plan {
  const normalizedId = planId?.toUpperCase() as PlanId;
  return PLANS[normalizedId] || PLANS.FREE;
}

/**
 * Get plan by Stripe price ID
 */
export function getPlanByPriceId(priceId: string): Plan {
  const plan = Object.values(PLANS).find(p => p.stripePriceId === priceId);
  return plan || PLANS.FREE;
}

/**
 * Get plan limits
 */
export function getPlanLimits(planId: string): PlanLimits {
  return getPlan(planId).limits;
}

/**
 * Get plan pricing for a specific currency
 */
export function getPlanPricing(planId: string, currency: Currency = 'USD'): PlanPricing {
  return getPlan(planId).pricing[currency];
}

/**
 * Format price with currency symbol
 */
export function formatPrice(amount: number, currency: Currency = 'USD'): string {
  const formatter = new Intl.NumberFormat(currency === 'THB' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: Currency): string {
  return currency === 'THB' ? '฿' : '$';
}

/**
 * Check if user can upgrade to a plan
 */
export function canUpgradeTo(currentPlan: string, targetPlan: string): boolean {
  const planOrder: PlanId[] = ['FREE', 'PLUS', 'PRO'];
  const currentIndex = planOrder.indexOf(currentPlan.toUpperCase() as PlanId);
  const targetIndex = planOrder.indexOf(targetPlan.toUpperCase() as PlanId);
  return targetIndex > currentIndex;
}

/**
 * Check if user can downgrade to a plan
 */
export function canDowngradeTo(currentPlan: string, targetPlan: string): boolean {
  const planOrder: PlanId[] = ['FREE', 'PLUS', 'PRO'];
  const currentIndex = planOrder.indexOf(currentPlan.toUpperCase() as PlanId);
  const targetIndex = planOrder.indexOf(targetPlan.toUpperCase() as PlanId);
  return targetIndex < currentIndex;
}

/**
 * Calculate yearly savings
 */
export function getYearlySavings(planId: string, currency: Currency = 'USD'): number {
  const pricing = getPlanPricing(planId, currency);
  const monthlyTotal = pricing.monthly * 12;
  return monthlyTotal - pricing.yearly;
}

/**
 * Get yearly discount percentage
 */
export function getYearlyDiscountPercent(planId: string, currency: Currency = 'USD'): number {
  const pricing = getPlanPricing(planId, currency);
  if (pricing.monthly === 0) return 0;
  const monthlyTotal = pricing.monthly * 12;
  return Math.round(((monthlyTotal - pricing.yearly) / monthlyTotal) * 100);
}

// ============================================================================
// FEATURE LIMIT HELPERS (for backward compatibility)
// ============================================================================

export function getAdAccountLimit(plan: string): number {
  return getPlanLimits(plan).adAccounts;
}

export function getPageLimit(plan: string): number {
  return getPlanLimits(plan).pages;
}

export function getTeamMemberLimit(plan: string): number {
  return getPlanLimits(plan).teamMembers;
}

export function getFacebookAccountLimit(plan: string): number {
  return getPlanLimits(plan).facebookAccounts;
}

export function getApiAccountCap(plan: string): number {
  return getPlanLimits(plan).apiAccountCap;
}

export function getLiteModeThreshold(plan: string): number {
  return getPlanLimits(plan).liteModeThreshold;
}

export function getAiGenerationsLimit(plan: string): number {
  return getPlanLimits(plan).aiGenerations;
}

export function hasAiAccess(plan: string): boolean {
  return getPlanLimits(plan).aiAccess;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_CURRENCY: Currency = 'USD';
export const DEFAULT_BILLING_CYCLE: BillingCycle = 'monthly';
export const TRIAL_DAYS = 14;

/** Supported currencies with display info */
export const CURRENCIES: Record<Currency, { symbol: string; name: string; locale: string }> = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  THB: { symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
};
