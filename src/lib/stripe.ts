import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey && process.env.NODE_ENV === 'production') {
  console.warn('STRIPE_SECRET_KEY is not set - billing will not work');
}

export const stripe = secretKey ? new Stripe(secretKey, { typescript: true }) : null;

export const PLANS = [
  { name: 'FREE', price: 0, priceId: '', limit: 10, features: [] },
  {
    name: 'PLUS',
    price: 39,
    priceId: process.env.STRIPE_PRICE_ID_PLUS || '',
    limit: 20,
    features: ['20 Ad Accounts', 'Advanced Analytics', 'Priority Support', 'AI Optimization'],
  },
  {
    name: 'PRO',
    price: 99,
    priceId: process.env.STRIPE_PRICE_ID_PRO || '',
    limit: 50,
    features: ['50 Ad Accounts', 'Enterprise Analytics', 'Dedicated Support', 'Early Access'],
  },
];

export function getPlanByPriceId(priceId: string) {
    return PLANS.find((plan) => plan.priceId === priceId) || PLANS[0];
}

export function getPlanByName(name: string) {
    return PLANS.find((plan) => plan.name === name) || PLANS[0];
}
