
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { PLANS } from '@/lib/stripe'; // Make sure this is importable by client, or duplicate for safe client usage
// Note: importing PLANS directly from lib/stripe might carry Node dependencies if not careful. 
// Ideally PLANS should be in shared config. For now, assuming it's safe or I'll redefine here for UI.

// Redefining for UI safety to avoid "fs" issues on client
const PRICING_PLANS = [
    {
        name: 'FREE',
        price: 0,
        description: 'For individuals just getting started.',
        features: ['10 Ad Accounts', 'Basic Analytics', 'Standard Support'],
        limit: '10 Ad Accounts',
    },
    {
        name: 'PLUS',
        price: 39,
        originalPrice: 99,
        description: 'For growing businesses and agencies.',
        features: ['20 Ad Accounts', 'Advanced Analytics', 'Priority Support', 'AI Optimization'],
        limit: '20 Ad Accounts',
        highlight: true,
    },
    {
        name: 'PRO',
        price: 99,
        originalPrice: 199,
        description: 'For power users and large teams.',
        features: ['50 Ad Accounts', 'Enterprise Analytics', 'Dedicated Support', 'Early Access Features'],
        limit: '50 Ad Accounts',
    },
];

export default function PricingPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);

    const handleUpgrade = async (planName: string) => {
        if (!session) {
            router.push('/login');
            return;
        }

        try {
            setLoading(planName);
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planName }),
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error('Checkout error:', data.error);
                alert('Failed to start checkout. Please try again.');
                setLoading(null);
            }
        } catch (error) {
            console.error('Error:', error);
            setLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/50 py-20 px-4 md:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold mb-4 font-outfit">Simple, Transparent Pricing</h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Choose the plan that best fits your needs. Upgrade or downgrade at any time.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {PRICING_PLANS.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative rounded-2xl p-8 border hover:shadow-xl transition-shadow duration-300 flex flex-col bg-white dark:bg-zinc-900 ${plan.highlight
                                ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg scale-105 z-10'
                                : 'border-zinc-200 dark:border-zinc-800'
                                }`}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                                    MOST POPULAR
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-4xl font-bold">${plan.price}</span>
                                    {plan.originalPrice && (
                                        <span className="text-xl text-muted-foreground line-through decoration-red-500/60 decoration-2">
                                            ${plan.originalPrice}
                                        </span>
                                    )}
                                    <span className="text-muted-foreground">/month</span>
                                </div>
                                <p className="text-sm text-muted-foreground">{plan.description}</p>
                            </div>

                            <div className="flex-1 mb-8">
                                <div className="text-sm font-medium mb-4 flex items-center gap-2">
                                    <Check className="w-4 h-4 text-blue-500" />
                                    {plan.limit}
                                </div>
                                <ul className="space-y-3">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                            <Check className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <Button
                                variant={plan.highlight ? 'default' : 'outline'}
                                className={`w-full font-semibold ${plan.highlight ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                onClick={() => handleUpgrade(plan.name)}
                                disabled={loading === plan.name || plan.name === 'FREE'}
                            >
                                {loading === plan.name ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : plan.name === 'FREE' ? (
                                    'Current Plan'
                                ) : (
                                    'Upgrade Now'
                                )}
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center text-sm text-muted-foreground">
                    <p>Payments are processed securely by Stripe. You can cancel at any time.</p>
                </div>
            </div>
        </div>
    );
}
