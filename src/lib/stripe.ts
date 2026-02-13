import Stripe from 'stripe';
import {
  PLANS as PLAN_CONFIG,
  getAllPlans,
  getPlan,
  getPlanByPriceId as _getPlanByPriceId,
  type Plan,
  type PlanId,
} from './plans';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey && process.env.NODE_ENV === 'production') {
  console.warn('STRIPE_SECRET_KEY is not set - billing will not work');
}

export const stripe = secretKey ? new Stripe(secretKey, { typescript: true }) : null;

/**
 * Legacy PLANS array for backward compatibility
 * @deprecated Use getAllPlans() or getPlan() from './plans' instead
 */
export const PLANS = getAllPlans().map(plan => ({
  name: plan.id,
  price: plan.pricing.USD.monthly,
  priceId: plan.stripePriceId || '',
  trialDays: plan.trialDays,
  features: plan.features
    .filter(f => f.included)
    .map(f => f.fallback),
}));

/**
 * Get plan by Stripe price ID
 * @deprecated Use getPlanByPriceId() from './plans' instead
 */
export function getPlanByPriceId(priceId: string) {
  const plan = _getPlanByPriceId(priceId);
  return {
    name: plan.id,
    price: plan.pricing.USD.monthly,
    priceId: plan.stripePriceId || '',
    trialDays: plan.trialDays,
    features: plan.features.filter(f => f.included).map(f => f.fallback),
  };
}

/**
 * Get plan by name
 * @deprecated Use getPlan() from './plans' instead
 */
export function getPlanByName(name: string) {
  const plan = getPlan(name);
  return {
    name: plan.id,
    price: plan.pricing.USD.monthly,
    priceId: plan.stripePriceId || '',
    trialDays: plan.trialDays,
    features: plan.features.filter(f => f.included).map(f => f.fallback),
  };
}

// Re-export new plan utilities for gradual migration
export { PLAN_CONFIG, getAllPlans, getPlan };
