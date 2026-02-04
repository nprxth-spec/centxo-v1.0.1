import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
    apiVersion: '2025-12-15.clover',
    typescript: true,
});

export const PLANS = [
    {
        name: 'FREE',
        price: 0,
        priceId: '', // No price ID for free
        limit: 10,
        features: ['10 Ad Accounts', 'Basic Analytics', 'Standard Support'],
    },
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
        features: ['50 Ad Accounts', 'Enterprise Analytics', 'Dedicated Support', 'Early Access Features'],
    },
];

export function getPlanByPriceId(priceId: string) {
    return PLANS.find((plan) => plan.priceId === priceId) || PLANS[0];
}

export function getPlanByName(name: string) {
    return PLANS.find((plan) => plan.name === name) || PLANS[0];
}
