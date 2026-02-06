'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, FileText, Zap, Loader2, Building2, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PLAN_LIMITS } from '@/lib/plan-limits';

const BILLING_PLANS = [
    { key: 'FREE' as const, price: 0, originalPrice: undefined as number | undefined, details: ['Campaign, Ad Set, Ad management', 'Basic analytics', 'Standard support', 'Single user only'] },
    { key: 'PLUS' as const, price: 39, originalPrice: 99, details: ['Everything in FREE', 'Advanced analytics', 'Priority support', 'AI Optimization', 'Team (3 members)', 'Adbox', 'Google Sheets export'] },
    { key: 'PRO' as const, price: 99, originalPrice: 199, details: ['Everything in PLUS', 'Enterprise analytics', 'Dedicated support', 'Early access', 'Team (10 members)', 'More accounts & pages'] },
];

export function BillingSettings() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [userPlan, setUserPlan] = useState<string>('FREE');
    const [loading, setLoading] = useState(true);
    const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);

    const defaultTab = searchParams.get('tab') || 'subscription';
    const [activeTab, setActiveTab] = useState(defaultTab);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

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
                setUserPlan((data.plan || 'FREE').toUpperCase());
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        const success = searchParams.get('success');
        const canceled = searchParams.get('canceled');
        if (success === 'true') {
            fetch('/api/user/plan').then(r => r.json()).then(data => setUserPlan((data.plan || 'FREE').toUpperCase()));
            router.replace(pathname + '?tab=subscription', { scroll: false });
        } else if (canceled === 'true') {
            router.replace(pathname + '?tab=subscription', { scroll: false });
        }
    }, [searchParams, pathname, router]);

    const handleManageBilling = async () => {
        setPortalLoading(true);
        try {
            const res = await fetch('/api/stripe/portal', { method: 'POST' });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert(data.error || 'Failed to open billing portal');
        } catch {
            alert('Failed to open billing portal');
        } finally {
            setPortalLoading(false);
        }
    };

    const handleUpgrade = async (planKey: string) => {
        if (planKey === 'FREE') return;
        setUpgradeLoading(planKey);
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planName: planKey }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || 'Failed to start checkout');
            }
        } catch (err) {
            alert('Failed to start checkout');
        } finally {
            setUpgradeLoading(null);
        }
    };

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
                            
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-3 gap-6">
                                    {BILLING_PLANS.map((plan) => {
                                        const isCurrent = userPlan === plan.key;
                                        const limits = PLAN_LIMITS[plan.key];
                                        return (
                                            <div
                                                key={plan.key}
                                                className={`bg-card border rounded-xl p-6 flex flex-col ${
                                                    isCurrent ? 'ring-2 ring-primary border-primary' : 'border-border'
                                                }`}
                                            >
                                                <div className="mb-4">
                                                    <h3 className="text-lg font-bold text-foreground">{plan.key}</h3>
                                                    <div className="flex items-baseline gap-2 mt-2">
                                                        <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                                                        {plan.originalPrice && (
                                                            <span className="text-muted-foreground line-through text-lg">${plan.originalPrice}</span>
                                                        )}
                                                        <span className="text-muted-foreground text-sm">{t('settings.billing.period', '/month')}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2 text-sm font-medium text-muted-foreground mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                                                        {limits.adAccounts} Ad Accounts
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                                        {limits.pages} Pages
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4 text-primary flex-shrink-0" />
                                                        {limits.teamMembers} Team · {limits.facebookAccounts} Facebook
                                                    </div>
                                                </div>

                                                <ul className="mb-6 space-y-2 flex-1">
                                                    {plan.details.map((item, i) => (
                                                        <li key={i} className="flex items-start text-sm text-muted-foreground">
                                                            <Check className="w-4 h-4 text-primary mr-2 flex-shrink-0 mt-0.5" />
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>

                                                {isCurrent && (userPlan === 'PLUS' || userPlan === 'PRO') ? (
                                                    <Button
                                                        variant="outline"
                                                        className="w-full"
                                                        onClick={handleManageBilling}
                                                        disabled={portalLoading}
                                                    >
                                                        {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('settings.billing.manage', 'Manage Subscription')}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant={isCurrent ? 'outline' : 'default'}
                                                        className={`w-full ${isCurrent ? 'cursor-default' : ''}`}
                                                        onClick={() => !isCurrent && handleUpgrade(plan.key)}
                                                        disabled={isCurrent || upgradeLoading !== null}
                                                    >
                                                        {upgradeLoading === plan.key ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : isCurrent ? (
                                                            t('settings.billing.currentPlan', 'Current Plan')
                                                        ) : (
                                                            t('settings.billing.upgrade', 'Upgrade')
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                                <h3 className="text-lg font-medium text-foreground">
                                    {userPlan === 'PLUS' || userPlan === 'PRO'
                                        ? t('settings.billing.managePayment', 'Manage payment methods')
                                        : 'No payment methods yet'}
                                </h3>
                                <p className="text-muted-foreground mt-2 max-w-sm">
                                    {userPlan === 'PLUS' || userPlan === 'PRO'
                                        ? t('settings.billing.portalDesc', 'Update payment method, view invoices, or cancel subscription.')
                                        : 'Add a payment method to upgrade your plan.'}
                                </p>
                                <Button variant="outline" className="mt-6" onClick={handleManageBilling} disabled={portalLoading}>
                                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (userPlan === 'PLUS' || userPlan === 'PRO' ? t('settings.billing.manage', 'Manage Billing') : 'Add Payment Method')}
                                </Button>
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
                                <h3 className="text-lg font-medium text-foreground">
                                    {userPlan === 'PLUS' || userPlan === 'PRO' ? t('settings.billing.viewInvoices', 'View and download invoices') : 'No invoices history'}
                                </h3>
                                <p className="text-muted-foreground mt-2 max-w-sm">
                                    {userPlan === 'PLUS' || userPlan === 'PRO'
                                        ? t('settings.billing.portalDesc', 'Open Stripe to view and download your invoices.')
                                        : 'Your invoice history will appear here once you make your first payment.'}
                                </p>
                                {(userPlan === 'PLUS' || userPlan === 'PRO') && (
                                    <Button variant="outline" className="mt-6" onClick={handleManageBilling} disabled={portalLoading}>
                                        {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('settings.billing.manage', 'Open Billing Portal')}
                                    </Button>
                                )}
                            </div>
                        </TabsContent>
                    </div>
                </div>
            </div>
        </Tabs>
    );
}
