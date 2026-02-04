'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export function BillingSettings() {
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
            name: t('settings.billing.plans.free.name', 'FREE'),
            price: '$0',
            period: t('settings.billing.period', '/month'),
            features: [
                t('settings.billing.plans.features.adAccounts10', '10 Ad Accounts'),
                t('settings.billing.plans.features.analyticsBasic', 'Basic Analytics'),
                t('settings.billing.plans.features.supportStandard', 'Standard Support')
            ],
        },
        {
            name: t('settings.billing.plans.plus.name', 'PLUS'),
            price: '$39',
            period: t('settings.billing.period', '/month'),
            features: [
                t('settings.billing.plans.features.adAccounts20', '20 Ad Accounts'),
                t('settings.billing.plans.features.analyticsAdvanced', 'Advanced Analytics'),
                t('settings.billing.plans.features.supportPriority', 'Priority Support'),
                t('settings.billing.plans.features.aiOptimization', 'AI Optimization')
            ],
        },
        {
            name: t('settings.billing.plans.pro.name', 'PRO'),
            price: '$99',
            period: t('settings.billing.period', '/month'),
            features: [
                t('settings.billing.plans.features.adAccounts50', '50 Ad Accounts'),
                t('settings.billing.plans.features.analyticsEnterprise', 'Enterprise Analytics'),
                t('settings.billing.plans.features.supportDedicated', 'Dedicated Support'),
                t('settings.billing.plans.features.earlyAccess', 'Early Access Features')
            ],
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                    {t('settings.billing', 'Billing & Subscription')}
                </h2>
                <p className="text-muted-foreground">
                    {t('settings.billingSubtitle', 'Manage your subscription and billing details')}
                </p>
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
                                {isCurrent ? t('settings.billing.currentPlan', 'Current Plan') : t('settings.billing.upgrade', 'Upgrade')}
                            </Button>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
