'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export default function SettingsBillingPage() {
    const { t } = useLanguage();
    const [userPlan, setUserPlan] = useState<string>('FREE');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/user/plan')
            .then(res => res.json())
            .then(data => {
                setUserPlan(data.plan || 'FREE');
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const plans = [
        {
            name: 'FREE',
            price: '$0',
            period: '/month',
            features: ['10 Ad Accounts', 'Basic Analytics', 'Standard Support'],
        },
        {
            name: 'PLUS',
            price: '$39',
            period: '/month',
            features: ['20 Ad Accounts', 'Advanced Analytics', 'Priority Support', 'AI Optimization'],
        },
        {
            name: 'PRO',
            price: '$99',
            period: '/month',
            features: ['50 Ad Accounts', 'Enterprise Analytics', 'Dedicated Support', 'Early Access Features'],
        },
    ];

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-foreground mb-2">{t('settings.billing', 'Billing & Subscription')}</h1>
                <p className="text-muted-foreground">{t('settings.billingSubtitle', 'Manage your subscription and billing details')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                    const isCurrent = userPlan === plan.name;
                    return (
                        <div key={plan.name} className={`glass-card p-6 flex flex-col ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}>
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                                <div className="flex items-baseline mt-2">
                                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                                    <span className="text-gray-500 ml-1">{plan.period}</span>
                                </div>
                            </div>

                            <ul className="mb-6 space-y-3 flex-1">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start text-sm text-gray-600">
                                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <Button
                                variant={isCurrent ? "outline" : "default"}
                                className={`w-full ${isCurrent ? "border-blue-500 text-blue-600 cursor-default hover:bg-transparent" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                            >
                                {isCurrent ? "Current Plan" : "Upgrade"}
                            </Button>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
