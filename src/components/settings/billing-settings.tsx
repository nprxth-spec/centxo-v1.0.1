'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check, CreditCard, FileText, Zap, Loader2, ExternalLink, Trash2, ArrowLeft, Search, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Import centralized plan configuration
import {
    getAllPlans,
    getPlan,
    formatPrice,
    type Currency,
    type BillingCycle,
} from '@/lib/plans';
import {
    PricingCard,
    BillingCycleToggle,
    CurrencySelector,
} from '@/components/pricing/PricingCard';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Stripe Element styles
const elementStyle = {
    base: {
        fontSize: '16px',
        color: '#1e293b',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        '::placeholder': { color: '#94a3b8' },
    },
    invalid: { color: '#ef4444' },
};

// Card Form Component using Stripe Elements
function CardFormContent({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
    const { t } = useLanguage();
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveCard, setSaveCard] = useState(true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setLoading(true);
        setError(null);

        try {
            // Get SetupIntent from our API
            const res = await fetch('/api/stripe/setup-intent', { method: 'POST' });
            const { clientSecret, error: apiError } = await res.json();

            if (apiError) throw new Error(apiError);

            const cardNumber = elements.getElement(CardNumberElement);
            if (!cardNumber) throw new Error('Card element not found');

            // Confirm the SetupIntent
            const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
                payment_method: { card: cardNumber },
            });

            if (stripeError) throw new Error(stripeError.message);

            if (setupIntent?.status === 'succeeded') {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || t('accountPage.payment.saveCardFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Back button */}
            <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                <span>{t('accountPage.payment.back')}</span>
            </button>

            <p className="text-primary font-semibold text-sm tracking-wide">{t('accountPage.payment.addNew')}</p>

            {/* Card Number */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('accountPage.payment.cardNumber')}</label>
                <div className="border border-slate-200 rounded-lg px-4 py-3 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all bg-white">
                    <CardNumberElement options={{ style: elementStyle, showIcon: true }} />
                </div>
            </div>

            {/* Expiry and CVC */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Expiration date</label>
                    <div className="border border-slate-200 rounded-lg px-4 py-3 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all bg-white">
                        <CardExpiryElement options={{ style: elementStyle, placeholder: 'MM / YY' }} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Security code</label>
                    <div className="relative">
                        <div className="border border-slate-200 rounded-lg px-4 py-3 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all bg-white">
                            <CardCvcElement options={{ style: elementStyle, placeholder: 'CVC' }} />
                        </div>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="h-5 w-6 text-slate-400" fill="none" viewBox="0 0 24 16" stroke="currentColor">
                                <rect x="1" y="1" width="22" height="14" rx="2" strokeWidth="1.5" />
                                <text x="12" y="11" fill="currentColor" fontSize="6" textAnchor="middle" fontFamily="monospace">123</text>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Save card checkbox */}
            <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${saveCard ? 'bg-primary border-primary' : 'border-slate-300'}`}>
                    {saveCard && <Check className="h-3 w-3 text-white" />}
                </div>
                <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} className="sr-only" />
                <span className="text-sm text-slate-700">Save credit card info</span>
            </label>

            {error && (
                <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>
            )}

            <Button type="submit" disabled={!stripe || loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Card
            </Button>
        </form>
    );
}

export function BillingSettings() {
    const { t, language } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [userPlan, setUserPlan] = useState<string>('FREE');
    const [createdAt, setCreatedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<{ id: string; brand: string; last4: string; expMonth?: number; expYear?: number }[]>([]);
    const [invoices, setInvoices] = useState<{ id: string; number: string; amountPaid: number; currency: string; status: string; created: string | null; invoicePdf: string | null; hostedInvoiceUrl: string | null }[]>([]);
    const [billingDataLoading, setBillingDataLoading] = useState(false);
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
    const [showAddCardForm, setShowAddCardForm] = useState(false);

    // Pricing options state
    const [currency, setCurrency] = useState<Currency>(language === 'th' ? 'THB' : 'USD');
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

    // Invoice filter states
    const [invoicePeriod, setInvoicePeriod] = useState<'this_month' | 'last_month' | 'all'>('all');
    const [invoiceSearch, setInvoiceSearch] = useState('');

    // Delete payment dialog state
    const [deleteDialogPaymentId, setDeleteDialogPaymentId] = useState<string | null>(null);
    // Error dialog state
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Direct Subscription Plan Selection
    const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
    const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

    const defaultTab = searchParams.get('tab') || 'subscription';
    const [activeTab, setActiveTab] = useState(defaultTab);

    // Get all plans from centralized config
    const allPlans = getAllPlans();

    // Calculate trial days left
    const getTrialDaysLeft = (): number | undefined => {
        if (userPlan !== 'FREE' || !createdAt) return undefined;
        const trialStart = new Date(createdAt);
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 14);
        const now = new Date();
        const diffTime = trialEnd.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

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
                setCreatedAt(data.createdAt || null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (activeTab === 'payment' || activeTab === 'invoices') {
            setBillingDataLoading(true);
            fetch('/api/user/billing-data')
                .then((res) => res.json())
                .then((data) => {
                    if (data.error) {
                        setErrorMessage(t('settings.billing.fetchError', 'Failed to load billing data. Please try again later.'));
                    } else {
                        setPaymentMethods(data.paymentMethods || []);
                        setInvoices(data.invoices || []);
                    }
                })
                .catch((err) => {
                    console.error('Billing fetch error:', err);
                    setErrorMessage(t('settings.billing.fetchError', 'Failed to load billing data.'));
                })
                .finally(() => setBillingDataLoading(false));
        }
    }, [activeTab]);

    useEffect(() => {
        const success = searchParams.get('success');
        const canceled = searchParams.get('canceled');
        if (success === 'true') {
            const refetch = () =>
                fetch('/api/user/plan').then(r => r.json()).then(data => setUserPlan((data.plan || 'FREE').toUpperCase()));
            refetch();
            // Retry after 2.5s in case webhook was slower than redirect
            const t = setTimeout(refetch, 2500);
            router.replace(pathname + '?tab=subscription', { scroll: false });
            return () => clearTimeout(t);
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

        // If payment methods exist, open confirmation dialog instead of redirecting
        if (paymentMethods.length > 0) {
            setConfirmPlan(planKey);
            setSelectedPaymentId(paymentMethods[0].id);
            return;
        }

        // Standard flow (redirect to Stripe Checkout)
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
                setErrorMessage(data.error || 'Failed to start checkout');
            }
        } catch (err) {
            setErrorMessage('Failed to start checkout');
        } finally {
            setUpgradeLoading(null);
        }
    };

    const handleDirectSubscription = async () => {
        if (!confirmPlan || !selectedPaymentId) return;

        // Close dialog first
        const planToUpgrade = confirmPlan;
        setConfirmPlan(null);
        setUpgradeLoading(planToUpgrade);

        try {
            const res = await fetch('/api/stripe/create-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planName: planToUpgrade,
                    paymentMethodId: selectedPaymentId
                }),
            });
            const data = await res.json();

            if (res.ok) {
                if (data.status === 'requires_action') {
                    setErrorMessage(t('settings.billing.requiresAction', 'This payment requires additional authentication. Please use a different card or contact support.'));
                } else {
                    // Success! Reload to update UI
                    window.location.href = `${pathname}?tab=subscription&success=true`;
                }
            } else {
                setErrorMessage(data.error || t('settings.billing.subscribeError', 'Failed to create subscription'));
            }
        } catch (err) {
            setErrorMessage('Failed to create subscription');
        } finally {
            setUpgradeLoading(null);
        }
    };

    const handleDeletePayment = async (paymentMethodId: string) => {
        setDeletingPaymentId(paymentMethodId);
        try {
            const res = await fetch('/api/stripe/payment-method', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethodId }),
            });
            const data = await res.json();
            if (res.ok) {
                setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId));
            } else {
                setErrorMessage(data.error || t('accountPage.payment.deleteFailed'));
            }
        } catch {
            setErrorMessage(t('accountPage.payment.deleteFailed'));
        } finally {
            setDeletingPaymentId(null);
            setDeleteDialogPaymentId(null);
        }
    };

    // Filter invoices based on period and search
    const filteredInvoices = invoices.filter((inv) => {
        // Filter by search
        if (invoiceSearch && !inv.number?.toLowerCase().includes(invoiceSearch.toLowerCase())) {
            return false;
        }

        // Filter by period
        if (invoicePeriod !== 'all' && inv.created) {
            const invoiceDate = new Date(inv.created);
            const now = new Date();
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

            if (invoicePeriod === 'this_month' && invoiceDate < thisMonthStart) {
                return false;
            }
            if (invoicePeriod === 'last_month' && (invoiceDate < lastMonthStart || invoiceDate > lastMonthEnd)) {
                return false;
            }
        }

        return true;
    });

    return (
        <>
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
                    <div className="border border-border rounded-lg bg-card shadow-sm overflow-hidden">
                        <div className="h-full overflow-y-auto px-6 md:px-8 lg:px-10 py-6 md:py-8">
                            <TabsContent value="subscription" className="space-y-6 mt-0">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <h2 className="text-section-title">{t('settings.billing', 'Billing & Subscription')}</h2>
                                        <p className="text-muted-foreground">
                                            {t('settings.billingSubtitle', 'Manage your subscription and billing details')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <CurrencySelector value={currency} onChange={setCurrency} />
                                        <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
                                    </div>
                                </div>
                                <div className="my-6 h-[1px] bg-border" />

                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <div className="grid md:grid-cols-3 gap-6">
                                        {allPlans.map((plan) => (
                                            <PricingCard
                                                key={plan.id}
                                                plan={plan}
                                                currency={currency}
                                                billingCycle={billingCycle}
                                                currentPlan={userPlan}
                                                onSelect={(planId) => {
                                                    if (planId === 'FREE') return;
                                                    // If paid plan is current, open billing portal
                                                    if (userPlan === planId && (planId === 'PLUS' || planId === 'PRO')) {
                                                        handleManageBilling();
                                                    } else {
                                                        handleUpgrade(planId);
                                                    }
                                                }}
                                                loading={upgradeLoading === plan.id || (portalLoading && userPlan === plan.id)}
                                                showTrialInfo={true}
                                                trialDaysLeft={getTrialDaysLeft()}
                                            />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="payment" className="space-y-6 mt-0">
                                <div className="space-y-0.5">
                                    <h2 className="text-section-title">{t('settings.billing.payment', 'Payment Methods')}</h2>
                                    <p className="text-muted-foreground">
                                        {t('settings.billing.paymentDesc', 'Manage your payment cards and billing info.')}
                                    </p>
                                </div>
                                <div className="my-6 h-[1px] bg-border" />

                                {billingDataLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Credit Card Header */}
                                        <div className="rounded-lg border-2 border-teal-600 bg-gradient-to-r from-slate-50 to-white p-5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full border-4 border-teal-600 flex items-center justify-center">
                                                        <div className="w-2 h-2 rounded-full bg-teal-600" />
                                                    </div>
                                                    <CreditCard className="h-5 w-5 text-slate-600" />
                                                    <span className="font-semibold text-slate-800">Credit card</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {/* Visa */}
                                                    <svg viewBox="0 0 48 32" className="h-6 w-9">
                                                        <rect width="48" height="32" rx="4" fill="#1A1F71" />
                                                        <text x="24" y="20" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="Arial">VISA</text>
                                                    </svg>
                                                    {/* Mastercard */}
                                                    <svg viewBox="0 0 48 32" className="h-6 w-9">
                                                        <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e7eb" />
                                                        <circle cx="18" cy="16" r="8" fill="#EB001B" />
                                                        <circle cx="30" cy="16" r="8" fill="#F79E1B" />
                                                    </svg>
                                                    {/* Amex */}
                                                    <svg viewBox="0 0 48 32" className="h-6 w-9">
                                                        <rect width="48" height="32" rx="4" fill="#006FCF" />
                                                        <text x="24" y="19" fill="white" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="Arial">AMEX</text>
                                                    </svg>
                                                    {/* Discover */}
                                                    <svg viewBox="0 0 48 32" className="h-6 w-9">
                                                        <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e7eb" />
                                                        <text x="24" y="18" fill="#FF6600" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="Arial">DISCOVER</text>
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Card Tiles Grid */}
                                            <div className="flex items-start gap-4 mt-5 flex-wrap">
                                                {paymentMethods.map((pm, index) => {
                                                    const b = pm.brand.toLowerCase();
                                                    const getBrandIcon = () => {
                                                        if (b === 'visa') return (
                                                            <svg viewBox="0 0 48 32" className="h-5 w-7">
                                                                <rect width="48" height="32" rx="3" fill="#1A1F71" />
                                                                <text x="24" y="19" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="Arial">VISA</text>
                                                            </svg>
                                                        );
                                                        if (b === 'mastercard') return (
                                                            <svg viewBox="0 0 48 32" className="h-5 w-7">
                                                                <rect width="48" height="32" rx="3" fill="#fff" stroke="#e5e7eb" />
                                                                <circle cx="18" cy="16" r="7" fill="#EB001B" />
                                                                <circle cx="30" cy="16" r="7" fill="#F79E1B" />
                                                            </svg>
                                                        );
                                                        if (b === 'amex' || b === 'american express') return (
                                                            <svg viewBox="0 0 48 32" className="h-5 w-7">
                                                                <rect width="48" height="32" rx="3" fill="#006FCF" />
                                                                <text x="24" y="18" fill="white" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="Arial">AMEX</text>
                                                            </svg>
                                                        );
                                                        return <CreditCard className="h-5 w-5 text-slate-400" />;
                                                    };

                                                    return (
                                                        <div
                                                            key={pm.id}
                                                            className={`group relative min-w-[120px] rounded-lg border-2 ${index === 0 ? 'border-teal-600 bg-teal-50/30' : 'border-slate-200 bg-white'} p-4 transition-all hover:shadow-md`}
                                                        >
                                                            {/* Delete button */}
                                                            <button
                                                                onClick={() => setDeleteDialogPaymentId(pm.id)}
                                                                disabled={deletingPaymentId === pm.id}
                                                                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md"
                                                            >
                                                                {deletingPaymentId === pm.id ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-3 w-3" />
                                                                )}
                                                            </button>

                                                            <div className="flex items-center gap-2 mb-2">
                                                                {getBrandIcon()}
                                                                <span className="text-xs text-slate-500 capitalize">{pm.brand}</span>
                                                            </div>
                                                            <p className="font-mono text-sm font-medium text-slate-800">****{pm.last4}</p>
                                                            {pm.expMonth != null && pm.expYear != null && (
                                                                <p className="text-xs text-slate-400 mt-1">
                                                                    {String(pm.expMonth).padStart(2, '0')}/{String(pm.expYear).slice(-2)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Add new card button */}
                                                <button
                                                    onClick={() => setShowAddCardForm(true)}
                                                    className="min-w-[120px] min-h-[90px] rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 flex flex-col items-center justify-center gap-2 transition-all hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
                                                >
                                                    <span className="text-2xl text-slate-400">+</span>
                                                    <span className="text-sm text-slate-500">Add new card</span>
                                                </button>
                                            </div>

                                            {/* Inline Card Form */}
                                            {showAddCardForm && (
                                                <div className="mt-6 pt-6 border-t border-slate-200">
                                                    <Elements stripe={stripePromise}>
                                                        <CardFormContent
                                                            onSuccess={() => {
                                                                setShowAddCardForm(false);
                                                                // Refresh payment methods
                                                                fetch('/api/user/billing-data')
                                                                    .then(res => res.json())
                                                                    .then(data => {
                                                                        if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
                                                                    });
                                                            }}
                                                            onCancel={() => setShowAddCardForm(false)}
                                                        />
                                                    </Elements>

                                                    {/* Footer info - only show in add card form */}
                                                    <div className="flex items-center justify-between text-sm text-slate-500 mt-6 pt-4 border-t border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                            </svg>
                                                            <span>Guaranteed safe & secure checkout</span>
                                                        </div>
                                                        <a
                                                            href="https://stripe.com"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
                                                        >
                                                            <span className="text-xs text-slate-500">Powered by</span>
                                                            <svg viewBox="0 0 60 25" className="h-4 w-12">
                                                                <text x="0" y="18" fill="#635BFF" fontSize="16" fontWeight="bold" fontFamily="Arial">stripe</text>
                                                            </svg>
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="invoices" className="space-y-6 mt-0">
                                <div className="space-y-0.5">
                                    <h2 className="text-section-title">{t('settings.billing.invoices', 'Invoices')}</h2>
                                    <p className="text-muted-foreground">
                                        {t('settings.billing.invoicesDesc', 'View all your invoices in one place.')}
                                    </p>
                                </div>
                                <div className="my-6 h-[1px] bg-border" />

                                {billingDataLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Filter Section */}
                                        <div className="rounded-lg border border-border p-5 space-y-4">
                                            <p className="text-primary font-semibold text-sm tracking-wide">FILTER</p>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Period Filter */}
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-2">Select period</label>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setInvoicePeriod('this_month')}
                                                            className={`px-4 py-2 text-sm border rounded-lg transition-colors ${invoicePeriod === 'this_month'
                                                                ? 'border-2 border-primary bg-primary/5 text-primary font-medium'
                                                                : 'border-border hover:bg-muted'
                                                                }`}
                                                        >
                                                            This month
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setInvoicePeriod('last_month')}
                                                            className={`px-4 py-2 text-sm border rounded-lg transition-colors ${invoicePeriod === 'last_month'
                                                                ? 'border-2 border-primary bg-primary/5 text-primary font-medium'
                                                                : 'border-border hover:bg-muted'
                                                                }`}
                                                        >
                                                            Last month
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setInvoicePeriod('all')}
                                                            className={`px-4 py-2 text-sm border rounded-lg transition-colors ${invoicePeriod === 'all'
                                                                ? 'border-2 border-primary bg-primary/5 text-primary font-medium'
                                                                : 'border-border hover:bg-muted'
                                                                }`}
                                                        >
                                                            All time
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Search */}
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-2">Invoice number</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={invoiceSearch}
                                                            onChange={(e) => setInvoiceSearch(e.target.value)}
                                                            placeholder="Enter Invoice number"
                                                            className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                                        />
                                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Invoices Table */}
                                        {filteredInvoices.length > 0 ? (
                                            <div className="rounded-lg border border-border overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/30">
                                                        <tr>
                                                            <th className="text-left p-4 font-medium text-muted-foreground">Invoice</th>
                                                            <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                                                            <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
                                                            <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                                                            <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredInvoices.map((inv) => (
                                                            <tr key={inv.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                                                                <td className="p-4">
                                                                    <span className="font-medium text-foreground">{inv.number}</span>
                                                                </td>
                                                                <td className="p-4 text-muted-foreground">
                                                                    {inv.created ? new Date(inv.created).toLocaleDateString('en-US', {
                                                                        year: 'numeric',
                                                                        month: 'short',
                                                                        day: '2-digit'
                                                                    }) : '—'}
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className="font-medium">
                                                                        ${inv.amountPaid.toFixed(2)}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${inv.status === 'paid'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : inv.status === 'open'
                                                                            ? 'bg-amber-100 text-amber-700'
                                                                            : 'bg-gray-100 text-gray-700'
                                                                        }`}>
                                                                        {inv.status}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    {inv.invoicePdf && (
                                                                        <a
                                                                            href={inv.invoicePdf}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                                                                        >
                                                                            <Download className="h-3.5 w-3.5" />
                                                                            Download
                                                                        </a>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-border">
                                                <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                                <h3 className="text-lg font-medium text-foreground">
                                                    {invoices.length > 0 ? 'No matching invoices' : 'No invoices yet'}
                                                </h3>
                                                <p className="text-muted-foreground mt-2 max-w-sm">
                                                    {invoices.length > 0
                                                        ? 'Try adjusting your filters to find what you\'re looking for.'
                                                        : 'Your invoice history will appear here once you make your first payment.'}
                                                </p>
                                            </div>
                                        )}

                                        <Button variant="outline" onClick={handleManageBilling} disabled={portalLoading}>
                                            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                                            {t('settings.billing.manage', 'Open Billing Portal')}
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </div>
                </div>
            </Tabs>

            {/* Delete Payment Method Dialog */}
            <AlertDialog open={!!deleteDialogPaymentId} onOpenChange={(open) => !open && setDeleteDialogPaymentId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('settings.billing.deleteTitle', 'Delete Payment Method')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('settings.billing.deleteDescription', 'Are you sure you want to delete this payment method? This action cannot be undone.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={!!deletingPaymentId}>
                            {t('common.cancel', 'Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteDialogPaymentId && handleDeletePayment(deleteDialogPaymentId)}
                            disabled={!!deletingPaymentId}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {deletingPaymentId ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    {t('common.deleting', 'Deleting...')}
                                </>
                            ) : (
                                t('common.delete', 'Delete')
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Error Dialog */}
            <AlertDialog open={!!errorMessage} onOpenChange={(open) => !open && setErrorMessage(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.error', 'Error')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {errorMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setErrorMessage(null)}>
                            {t('common.ok', 'OK')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirm Subscription Dialog */}
            <AlertDialog open={!!confirmPlan} onOpenChange={(open) => !open && setConfirmPlan(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl">{t('settings.billing.reviewSubscription', 'Review your subscription')}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-6 pt-2">
                                <p className="text-muted-foreground text-sm">
                                    {t('settings.billing.upgradeDesc', 'You are upgrading to the')} <span className="font-bold text-foreground">{confirmPlan ? t(getPlan(confirmPlan).nameKey, getPlan(confirmPlan).name) : ''}</span> {t('settings.billing.plan', 'plan')}.
                                </p>

                                {confirmPlan && (() => {
                                    const selectedPlan = getPlan(confirmPlan);
                                    const pricing = selectedPlan.pricing[currency];
                                    const price = billingCycle === 'monthly' ? pricing.monthly : pricing.yearly;
                                    return (
                                        <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-3 text-sm shadow-sm">
                                            <div className="flex justify-between items-center text-muted-foreground pb-3 border-b border-border/50 border-dashed">
                                                <span>{t('settings.billing.billingCycle', 'Billing Cycle')}</span>
                                                <span className="font-medium text-foreground">
                                                    {billingCycle === 'monthly' 
                                                        ? t('settings.billing.monthly', 'Monthly')
                                                        : t('settings.billing.yearly', 'Yearly')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-muted-foreground">
                                                <span>{t('settings.billing.planPrice', 'Plan Price')}</span>
                                                <span className="font-medium text-foreground">{formatPrice(price, currency)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-border/50 border-dashed font-bold text-base mt-2">
                                                <span>{t('settings.billing.total', 'Total due today')}</span>
                                                <span className="text-primary">{formatPrice(price, currency)}</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-primary" />
                                        {t('settings.billing.selectCard', 'Payment Method')}
                                    </label>
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                        {paymentMethods.map(pm => (
                                            <div
                                                key={pm.id}
                                                onClick={() => setSelectedPaymentId(pm.id)}
                                                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${selectedPaymentId === pm.id
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                                                    : 'border-border hover:bg-muted/50 hover:border-primary/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${selectedPaymentId === pm.id ? 'border-primary' : 'border-muted-foreground'
                                                        }`}>
                                                        {selectedPaymentId === pm.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm font-medium capitalize">{pm.brand}</span>
                                                        <span className="text-sm text-muted-foreground">•••• {pm.last4}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel disabled={!!upgradeLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDirectSubscription();
                            }}
                            disabled={!selectedPaymentId || !!upgradeLoading}
                            className="bg-primary hover:bg-primary/90 min-w-[120px]"
                        >
                            {upgradeLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    {t('common.processing', 'Processing...')}
                                </>
                            ) : (
                                t('common.confirmPay', 'Confirm & Pay')
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
