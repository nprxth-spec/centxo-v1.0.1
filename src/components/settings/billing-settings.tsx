'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, FileText, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function BillingSettings() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [userPlan, setUserPlan] = useState<string>('FREE');
    const [loading, setLoading] = useState(true);

    const defaultTab = searchParams.get('tab') || 'subscription';
    const [activeTab, setActiveTab] = useState(defaultTab);

    // Update URL when tab changes
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // Sync state if URL changes externally
    useEffect(() => {
        const tabFromUrl = searchParams.get('tab');
        if (tabFromUrl && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [searchParams]);

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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
            {/* Tabs Header Box - Attached to Header */}
            <div className="border-b border-r border-border bg-card shadow-sm overflow-x-auto">
                <TabsList className="flex w-full justify-start bg-transparent p-0 h-auto gap-4 md:gap-6 pt-3 pb-0 transition-all duration-200 pl-4 md:pl-[3.5rem] lg:pl-[4.5rem] min-w-max md:min-w-0">
                    <TabsTrigger
                        value="subscription"
                        className="rounded-none border-b-2 border-transparent bg-transparent px-0 pt-2.5 pb-3.5 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none flex items-center"
                    >
                        <Zap className="mr-2 h-4 w-4" />
                        {t('settings.billing.subscription', 'Subscription')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="payment"
                        className="rounded-none border-b-2 border-transparent bg-transparent px-0 pt-2.5 pb-3.5 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none flex items-center"
                    >
                        <CreditCard className="mr-2 h-4 w-4" />
                        {t('settings.billing.payment', 'Payment Methods')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="invoices"
                        className="rounded-none border-b-2 border-transparent bg-transparent px-0 pt-2.5 pb-3.5 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none flex items-center"
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        {t('settings.billing.invoices', 'Invoices')}
                    </TabsTrigger>
                </TabsList>
            </div>

            {/* Content Box - Centered */}
            <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
                <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                    <div className="h-full overflow-y-auto px-6 md:px-8 lg:px-10 py-6 md:py-8">
                        <TabsContent value="subscription" className="space-y-6 mt-0">
                            <div className="space-y-0.5">
                                <h2 className="text-2xl font-bold tracking-tight">{t('settings.billing', 'Billing & Subscription')}</h2>
                                <p className="text-muted-foreground">
                                    {t('settings.billingSubtitle', 'Manage your subscription and billing details')}
                                </p>
                            </div>
                            <div className="my-6 h-[1px] bg-border" />
                            
                            <div className="grid md:grid-cols-3 gap-6">
                                {plans.map((plan) => {
                                    const isCurrent = userPlan === plan.name;
                                    return (
                                        <div key={plan.name} className={`bg-card border border-border rounded-xl p-6 flex flex-col ${isCurrent ? 'ring-2 ring-primary border-primary' : ''}`}>
                                            <div className="mb-4">
                                                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                                                <div className="flex items-baseline mt-2">
                                                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                                                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                                                </div>
                                            </div>

                                            <ul className="mb-6 space-y-3 flex-1">
                                                {plan.features.map((feature) => (
                                                    <li key={feature} className="flex items-start text-sm text-muted-foreground">
                                                        <Check className="w-4 h-4 text-primary mr-2 flex-shrink-0 mt-0.5" />
                                                        {feature}
                                                    </li>
                                                ))}
                                            </ul>

                                            <Button
                                                variant={isCurrent ? "outline" : "default"}
                                                className={`w-full ${isCurrent ? "cursor-default" : ""}`}
                                            >
                                                {isCurrent ? t('settings.billing.currentPlan', 'Current Plan') : t('settings.billing.upgrade', 'Upgrade')}
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </TabsContent>

                        <TabsContent value="payment" className="space-y-6 mt-0">
                             <div className="space-y-0.5">
                                <h2 className="text-2xl font-bold tracking-tight">{t('settings.billing.payment', 'Payment Methods')}</h2>
                                <p className="text-muted-foreground">
                                    {t('settings.billing.paymentDesc', 'Manage your payment cards and billing info.')}
                                </p>
                            </div>
                            <div className="my-6 h-[1px] bg-border" />
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <CreditCard className="h-12 w-12 text-muted-foreground/20 mb-4" />
                                <h3 className="text-lg font-medium text-foreground">No payment methods yet</h3>
                                <p className="text-muted-foreground mt-2 max-w-sm">
                                    Add a payment method to upgrade your plan and manage your subscription.
                                </p>
                                <Button variant="outline" className="mt-6">Add Payment Method</Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="invoices" className="space-y-6 mt-0">
                            <div className="space-y-0.5">
                                <h2 className="text-2xl font-bold tracking-tight">{t('settings.billing.invoices', 'Invoices')}</h2>
                                <p className="text-muted-foreground">
                                    {t('settings.billing.invoicesDesc', 'View and download your past invoices.')}
                                </p>
                            </div>
                            <div className="my-6 h-[1px] bg-border" />
                             <div className="flex flex-col items-center justify-center py-12 text-center">
                                <FileText className="h-12 w-12 text-muted-foreground/20 mb-4" />
                                <h3 className="text-lg font-medium text-foreground">No invoices history</h3>
                                <p className="text-muted-foreground mt-2 max-w-sm">
                                    Your invoice history will appear here once you make your first payment.
                                </p>
                            </div>
                        </TabsContent>
                    </div>
                </div>
            </div>
        </Tabs>
    );
}
