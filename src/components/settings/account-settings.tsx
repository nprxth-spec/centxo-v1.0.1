'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { User, CreditCard, Settings, Zap, Mail, Check, Layers, Smartphone, Sparkles, Sliders, ChevronRight, Loader2, FileText, Trash2, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { SessionManagement } from './session-management';
import { ProfileSettings } from './profile-settings';
import { DeleteAccountSettings } from './delete-account-settings';
import { AppearanceSettings } from './appearance-settings';
import { TeamSettings } from './team-settings';
import { ManageAccessContent } from './ManageAccessContent';
import { LayoutPanelTop, Settings2 } from 'lucide-react';

// Initialize Stripe - only if publishable key is available
const getStripePromise = () => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
        if (typeof window !== 'undefined') {
            console.error('[Stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Payment forms will not work.');
        }
        return null;
    }
    return loadStripe(publishableKey);
};

const stripePromise = getStripePromise();

const elementStyle = {
    base: {
        fontSize: '16px',
        color: '#1e293b',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        '::placeholder': { color: '#94a3b8' },
    },
    invalid: { color: '#ef4444' },
};

function CardFormContent({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/stripe/setup-intent', { method: 'POST' });
            const { clientSecret, error: apiError } = await res.json();

            if (apiError) throw new Error(apiError);

            const cardNumber = elements.getElement(CardNumberElement);
            if (!cardNumber) throw new Error('Card element not found');

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
            <div className="flex items-center gap-2 mb-4">
                <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 rotate-180" /> Back
                </button>
                <h3 className="font-semibold text-foreground">Add New Card</h3>
            </div>

            <div>
                <label className="block text-sm font-medium text-foreground mb-2">Card number</label>
                <div className="border border-input rounded-lg px-4 py-3 bg-background">
                    <CardNumberElement options={{ style: elementStyle, showIcon: true }} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Expiration</label>
                    <div className="border border-input rounded-lg px-4 py-3 bg-background">
                        <CardExpiryElement options={{ style: elementStyle }} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-foreground mb-2">CVC</label>
                    <div className="border border-input rounded-lg px-4 py-3 bg-background">
                        <CardCvcElement options={{ style: elementStyle }} />
                    </div>
                </div>
            </div>

            {error && <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg">{error}</div>}

            <Button type="submit" disabled={!stripe || loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Card'}
            </Button>
        </form>
    );
}



export function AccountSettings() {
    const { t } = useLanguage();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Menu items ordered by importance:
    // 1. Profile - Personal information (most important)
    // 2. Subscription - Plans and membership (critical for usage)
    // 3. Payment Methods - Payment cards (critical for billing)
    // 4. Billing History - Invoices and receipts (important for records)
    // 5. Team - Team management (important for collaboration)
    // 6. Login Sessions - Security and active sessions (important for security)
    // 7. Appearance - UI preferences (less critical)
    // 8. Delete Account - Account deletion (should be last)
    const [userPlan, setUserPlan] = useState<string>('FREE');
    const [teamRole, setTeamRole] = useState<string>('OWNER');
    const [createdAt, setCreatedAt] = useState<string | null>(null);

    const isOwner = teamRole === 'OWNER';

    const menuItems = [
        { id: 'profile', icon: User, label: t('accountPage.menu.profile'), desc: t('accountPage.menu.profileDesc') },
        ...(isOwner ? [
            { id: 'subscription', icon: Layers, label: t('accountPage.menu.subscription', 'Subscription'), desc: t('accountPage.menu.subscriptionDesc', 'Plans and membership') },
            { id: 'payment-billing', icon: CreditCard, label: t('accountPage.menu.paymentAndBilling', 'Payment & Billing'), desc: t('accountPage.menu.paymentAndBillingDesc', 'Manage payment methods and invoices') },
        ] : []),
        { id: 'team', icon: Users, label: t('settings.teamAndConnection', 'Team & Connection'), desc: t('settings.teamAndConnectionDesc', 'Manage team members and Meta connection.') },
        { id: 'sessions', icon: Smartphone, label: t('accountPage.menu.sessions'), desc: t('accountPage.menu.sessionsDesc') },
        { id: 'appearance', icon: Sparkles, label: t('accountPage.menu.appearance'), desc: t('accountPage.menu.appearanceDesc') },
        { id: 'advanced', icon: Trash2, label: t('accountPage.menu.deleteAccount', 'Delete Account'), desc: t('accountPage.menu.deleteAccountDesc', 'Permanently delete your account') },
    ];
    const [paymentMethods, setPaymentMethods] = useState<{ id: string; brand: string; last4: string; expMonth?: number; expYear?: number }[]>([]);
    const [invoices, setInvoices] = useState<{ id: string; number: string; amountPaid: number; currency: string; status: string; created: string | null; invoicePdf: string | null; hostedInvoiceUrl: string | null }[]>([]);
    const [showAddCardForm, setShowAddCardForm] = useState(false);
    const [billingDataLoading, setBillingDataLoading] = useState(false);
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
    const [deleteDialogPaymentId, setDeleteDialogPaymentId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [profileDisplay, setProfileDisplay] = useState<{ name: string; email: string } | null>(null);

    const initialTab = searchParams.get('tab') || 'profile';
    // Handle redirects from old payment/invoices tabs
    const normalizedTab = initialTab === 'payment' || initialTab === 'invoices' ? 'payment-billing' : initialTab;
    const [activeTab, setActiveTab] = useState(normalizedTab);
    const initialSubTab = searchParams.get('subtab') || (initialTab === 'invoices' ? 'invoices' : 'payment');
    const [paymentSubTab, setPaymentSubTab] = useState<'payment' | 'invoices'>(initialSubTab as 'payment' | 'invoices');

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

    // Fetch Plan and Created At
    useEffect(() => {
        fetch('/api/user/plan')
            .then(res => res.json())
            .then(data => {
                setUserPlan((data.plan || 'FREE').toUpperCase());
                setCreatedAt(data.createdAt || null);
                setTeamRole(data.teamRole || 'OWNER');
            })
            .catch(console.error);
    }, []);

    // Redirect if accessing restricted tab as non-owner
    useEffect(() => {
        if (!isOwner && (activeTab === 'subscription' || activeTab === 'payment-billing')) {
            handleTabChange('profile');
        }
    }, [isOwner, activeTab]);

    // Fetch profile for sidebar display
    useEffect(() => {
        if (session?.user) {
            fetch('/api/user/account-profile')
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data) {
                        setProfileDisplay({
                            name: data.displayName || session?.user?.name || '',
                            email: data.displayEmail || session?.user?.email || ''
                        });
                    } else {
                        setProfileDisplay({
                            name: session?.user?.name || '',
                            email: session?.user?.email || ''
                        });
                    }
                })
                .catch(() => {
                    setProfileDisplay({
                        name: session?.user?.name || '',
                        email: session?.user?.email || ''
                    });
                });
        }
    }, [session?.user?.name, session?.user?.email]);

    // Handle URL params for payment sub-tabs
    useEffect(() => {
        const tab = searchParams.get('tab');
        const subtab = searchParams.get('subtab');

        // Handle redirects from old payment/invoices tabs
        if (tab === 'payment') {
            router.replace(`${pathname}?tab=payment-billing&subtab=payment`);
            setActiveTab('payment-billing');
            setPaymentSubTab('payment');
        } else if (tab === 'invoices') {
            router.replace(`${pathname}?tab=payment-billing&subtab=invoices`);
            setActiveTab('payment-billing');
            setPaymentSubTab('invoices');
        } else if (tab === 'payment-billing') {
            setActiveTab('payment-billing');
            if (subtab === 'invoices') {
                setPaymentSubTab('invoices');
            } else {
                setPaymentSubTab('payment');
            }
        } else {
            setActiveTab(tab || 'profile');
        }
    }, [searchParams, router, pathname]);

    // Fetch Billing Data (Payment Methods and Invoices)
    useEffect(() => {
        if (activeTab === 'payment-billing' || activeTab === 'subscription') {
            // Fetch payment methods for both payment-billing and subscription tabs
            // (subscription needs payment methods to use existing cards)
            fetch('/api/user/billing-data')
                .then((res) => res.json())
                .then((data) => {
                    if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
                    if (activeTab === 'payment-billing' && data.invoices) setInvoices(data.invoices);
                })
                .catch(console.error);
        }
    }, [activeTab]);


    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showPackageDialog, setShowPackageDialog] = useState(false);
    const [showCustomDialog, setShowCustomDialog] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState(1);

    // Custom Plan State
    const [customPages, setCustomPages] = useState(5);
    const [customUsers, setCustomUsers] = useState(2);
    const [customAdAccounts, setCustomAdAccounts] = useState(10);
    const [customDuration, setCustomDuration] = useState(1);

    const [creating, setCreating] = useState(false);
    const [selectedPaymentId, setSelectedPaymentId] = useState<string>('new');

    // Confirmation dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingPackage, setPendingPackage] = useState<{
        packageId: string;
        pages: number;
        users: number;
        months: number;
        amount: number;
        adAccountsLimit?: number;
        packageName?: string;
        packageType?: string;
    } | null>(null);

    // Cleanup function for dialog overlays
    const cleanupDialogOverlays = useCallback(() => {
        // Reset body styles
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
        document.body.removeAttribute('data-scroll-locked');

        // Remove any lingering overlay elements that are closed
        const allOverlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
        allOverlays.forEach((overlay) => {
            const element = overlay as HTMLElement;
            const state = element.getAttribute('data-state');
            // Remove if closed or if dialogs are not open
            if (state === 'closed' || (!showPackageDialog && !showCustomDialog && !showConfirmDialog)) {
                element.style.display = 'none';
                element.style.pointerEvents = 'none';
                element.style.opacity = '0';
                element.remove();
            }
        });

        // Also check for any portal containers that might be blocking
        const portals = document.querySelectorAll('[data-radix-portal]');
        portals.forEach((portal) => {
            const children = portal.querySelectorAll('[data-state="closed"]');
            children.forEach((child) => {
                const el = child as HTMLElement;
                if (el.hasAttribute('data-radix-alert-dialog-overlay') || el.hasAttribute('data-radix-dialog-overlay')) {
                    el.remove();
                }
            });
            // Remove empty portals
            if (portal.children.length === 0) {
                portal.remove();
            }
        });
    }, [showPackageDialog, showCustomDialog, showConfirmDialog]);

    // Cleanup when dialogs close
    useEffect(() => {
        if (!showPackageDialog && !showCustomDialog && !showConfirmDialog) {
            cleanupDialogOverlays();
            // Multiple delayed cleanups to catch animation delays
            const timers = [50, 100, 200, 300, 500, 1000].map(delay =>
                setTimeout(cleanupDialogOverlays, delay)
            );
            return () => {
                timers.forEach(timer => clearTimeout(timer));
            };
        }
    }, [showPackageDialog, showCustomDialog, showConfirmDialog, cleanupDialogOverlays]);

    useEffect(() => {
        if (paymentMethods.length > 0 && selectedPaymentId === 'new') {
            setSelectedPaymentId(paymentMethods[0].id);
        }
    }, [paymentMethods]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        // Handle legacy 'account' tab redirect to 'subscription'
        if (tab === 'account') {
            const params = new URLSearchParams(searchParams.toString());
            params.set('tab', 'subscription');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            setActiveTab('subscription');
        } else if (tab && tab !== activeTab) {
            setActiveTab(tab);
        } else if (!tab) {
            // Default to profile if no tab specified
            setActiveTab('profile');
        }
    }, [searchParams, activeTab, pathname, router]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // Pricing Constants (USD)
    // Anchor: Custom Plan 5 Pages / 5 Users / 5 Ad Accounts = ~$39/month
    //
    // Formula: BASE + (pages * PAGE) + (users * USER) + (adAccounts * AD)
    //
    // Custom plan examples:
    //   1P/1U/1A  = $11       3P/2U/5A  = $25       5P/5U/5A  = $39
    //   7P/3U/10A = $45.5     10P/5U/15A = $66.5    25P/10U/30A = $141.5
    //
    // Predefined plans offer bundled discounts vs custom equivalent:
    //   Standard (3P/2U/5A)   custom=$25  → predefined $19  (24% off)
    //   Plus     (7P/3U/10A)  custom=$45  → predefined $39  (14% off)
    //   Pro      (25P/10U/30A) custom=$141 → predefined $99  (30% off)
    const BASE_PRICE = 4;    // Base platform fee
    const PRICE_PER_PAGE = 2.5;  // Per page per month
    const PRICE_PER_USER = 3;    // Per user per month
    const PRICE_PER_AD_ACCOUNT = 1.5; // Per ad account per month

    const DURATION_DISCOUNTS: Record<number, number> = {
        1: 1,
        3: 0.95,
        6: 0.85,
        12: 0.75,
    };

    const RESOURCE_OPTIONS = (() => {
        const options = [];
        for (let i = 1; i <= 30; i++) options.push(i);
        for (let i = 35; i <= 500; i += 5) options.push(i);
        return options;
    })();

    const calculateCustomPrice = () => {
        const monthlyBase = BASE_PRICE
            + (customPages * PRICE_PER_PAGE)
            + (customUsers * PRICE_PER_USER)
            + (customAdAccounts * PRICE_PER_AD_ACCOUNT);

        const total = monthlyBase * customDuration;
        const discount = DURATION_DISCOUNTS[customDuration] || 1;

        return {
            original: total,
            total: Math.ceil(total * discount),
            monthlyWithDiscount: Math.ceil((total * discount) / customDuration)
        };
    };

    const PACKAGES = [
        {
            id: 'mini',
            name: 'Standard',
            pages: 3,
            users: 2,
            adAccounts: 5,
            popular: false,
            description: 'เหมาะสำหรับผู้เริ่มต้น',
            price: 19,
            originalPrice: 25, // Custom equivalent: $25
            features: [
                '5 Ad Accounts',
                '3 Pages',
                '2 ผู้ใช้',
                'Campaign, Ad Set, Ad management',
                'Basic analytics',
                'Standard support'
            ]
        },
        {
            id: 'standard',
            name: 'Plus',
            pages: 7,
            users: 3,
            adAccounts: 10,
            popular: true,
            description: 'สำหรับธุรกิจที่กำลังเติบโต',
            price: 39,
            originalPrice: 46, // Custom equivalent: $45.5
            tag: '🔥 ขายดี',
            features: [
                '10 Ad Accounts',
                '7 Pages',
                '3 ผู้ใช้',
                'AI Optimization',
                'Advanced analytics',
                'Priority support',
                'Google Sheets export'
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            pages: 25,
            users: 10,
            adAccounts: 30,
            popular: false,
            description: 'สำหรับเอเจนซี่และทีมขนาดใหญ่',
            price: 99,
            originalPrice: 142, // Custom equivalent: $141.5
            hasSupport: true,
            features: [
                '30 Ad Accounts',
                '25 Pages',
                '10 ผู้ใช้',
                'AI Optimization & Generation',
                'Enterprise analytics',
                'Dedicated support',
                'Team (10 members)'
            ]
        },
    ];

    const calculatePrice = (pages: number, users: number, months: number, baseMonthlyOverride?: number) => {
        const baseMonthly = baseMonthlyOverride ?? (pages * PRICE_PER_PAGE + users * PRICE_PER_USER);
        const basePrice = baseMonthly * months;
        const discountRate = DURATION_DISCOUNTS[months] || 1;
        const total = Math.round(basePrice * discountRate);
        const original = basePrice;
        const discount = Math.round((1 - discountRate) * 100);
        return { total, original, discount };
    };

    const createPackage = async (packageId: string, pages: number, users: number, months: number, amount: number, adAccountsLimit?: number) => {
        setCreating(true);
        setErrorMessage(null);

        // Find package info for name and type
        const pkg = PACKAGES.find(p => p.id === packageId);
        const packageName = pkg?.name || 'Custom Plan';
        const packageType = pkg?.id || 'custom';

        if (amount > 0 && paymentMethods.length === 0) {
            setErrorMessage(t('accountPage.error.addCardBeforePackage'));
            handleTabChange('payment');
            setShowPackageDialog(false);
            setCreating(false);
            return;
        }

        // If payment methods exist and amount > 0, show confirmation dialog first
        if (amount > 0 && paymentMethods.length > 0) {
            setPendingPackage({ packageId, pages, users, months, amount, adAccountsLimit, packageName, packageType });
            setShowPackageDialog(false);
            setShowCustomDialog(false);
            setShowConfirmDialog(true);
            setCreating(false);
            return;
        }

        // Proceed with payment (no payment methods or free plan)
        await processPackagePayment(packageId, pages, users, months, amount, adAccountsLimit, packageName, packageType);
    };

    const processPackagePayment = async (packageId: string, pages: number, users: number, months: number, amount: number, adAccountsLimit?: number, packageName?: string, packageType?: string) => {
        setCreating(true);
        setErrorMessage(null);

        try {
            // Custom Plan (or any paid package): use existing payment method if available
            if (amount > 0) {
                // If payment methods exist, use the first one directly
                if (paymentMethods.length > 0) {
                    const selectedPaymentMethodId = paymentMethods[0].id;
                    const res = await fetch('/api/stripe/charge-custom-package', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pages,
                            users,
                            months,
                            adAccounts: adAccountsLimit ?? 0,
                            amount,
                            paymentMethodId: selectedPaymentMethodId,
                            packageName: packageName || 'Custom Plan',
                            packageType: packageType || 'custom',
                        }),
                    });
                    const data = await res.json();

                    if (!res.ok) {
                        setErrorMessage(data.error || t('accountPage.error.createFailed'));
                        setCreating(false);
                        return;
                    }

                    // Check if 3D Secure is required
                    if (data.requiresAction && data.clientSecret) {
                        // Handle 3D Secure - redirect to Stripe Checkout for authentication
                        setErrorMessage('This payment requires additional authentication. Redirecting...');
                        // Fall back to checkout for 3DS
                        const checkoutRes = await fetch('/api/stripe/checkout-custom-package', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                pages,
                                users,
                                months,
                                adAccounts: adAccountsLimit ?? 0,
                                amount,
                                packageName: packageName || 'Custom Plan',
                                packageType: packageType || 'custom',
                            }),
                        });
                        const checkoutData = await checkoutRes.json();
                        if (checkoutData.url) {
                            setShowPackageDialog(false);
                            setShowCustomDialog(false);
                            setErrorMessage(null);
                            setCreating(false);
                            window.location.href = checkoutData.url;
                            return;
                        }
                    }

                    // Success - refresh subscriptions
                    if (data.success) {
                        setShowPackageDialog(false);
                        setShowCustomDialog(false);
                        setErrorMessage(null);
                        setCreating(false);
                        setTimeout(() => cleanupDialogOverlays(), 100);
                        refreshSubscriptions();
                        return;
                    }
                } else {
                    // No payment methods - redirect to Stripe Checkout
                    const res = await fetch('/api/stripe/checkout-custom-package', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pages,
                            users,
                            months,
                            adAccounts: adAccountsLimit ?? 0,
                            amount,
                            packageName: packageName || 'Custom Plan',
                            packageType: packageType || 'custom',
                        }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        setErrorMessage(data.error || t('accountPage.error.createFailed'));
                        setCreating(false);
                        return;
                    }
                    if (data.url) {
                        setShowPackageDialog(false);
                        setShowCustomDialog(false);
                        setErrorMessage(null);
                        setCreating(false);
                        setTimeout(() => cleanupDialogOverlays(), 100);
                        window.location.href = data.url;
                        return;
                    }
                }
            }

            // Free package (amount === 0): create subscription directly
            const res = await fetch('/api/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    packageId,
                    pages,
                    users,
                    adAccounts: adAccountsLimit || 0,
                    months,
                    amount,
                    name: packageName || 'Custom Plan',
                    type: packageType || 'custom',
                })
            });

            const data = await res.json();
            if (res.ok) {
                setShowPackageDialog(false);
                setShowCustomDialog(false);
                setErrorMessage(null);
                setTimeout(() => cleanupDialogOverlays(), 100);
                // Re-fetch subscriptions
                const subsRes = await fetch('/api/subscriptions');
                const subsData = await subsRes.json();
                if (subsData.subscriptions) {
                    setSubscriptions(subsData.subscriptions.map((sub: any) => {
                        const now = new Date();
                        const expires = new Date(sub.expiresAt);
                        const isExpired = expires < now;
                        const daysRemaining = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        let expiryText = '';
                        if (isExpired) {
                            expiryText = expires.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                        } else {
                            expiryText = daysRemaining > 30 ? `เหลืออีก ${Math.floor(daysRemaining / 30)} เดือน` : `เหลืออีก ${daysRemaining} วัน`;
                        }
                        return {
                            ...sub,
                            id: sub.packageId,
                            pages: Array.isArray(sub.selectedPageIds) ? sub.selectedPageIds.length : 0,
                            maxPages: sub.pagesLimit || 5,
                            adAccounts: Array.isArray(sub.selectedAdAccountIds) ? sub.selectedAdAccountIds.length : 0,
                            maxAdAccounts: sub.adAccountsLimit ?? 0,
                            users: Array.isArray(sub.selectedUserIds) ? sub.selectedUserIds.length : 0,
                            maxUsers: sub.usersLimit || 5,
                            amount: sub.amount,
                            status: sub.status || (isExpired ? 'expired' : 'active'),
                            expiry: expiryText,
                            autoRenew: sub.autoRenew
                        };
                    }));
                }
            } else {
                setErrorMessage(data.error || t('accountPage.error.createFailed'));
            }
        } catch (error) {
            console.error('Failed to create plan', error);
            setErrorMessage(t('accountPage.error.general'));
        } finally {
            setCreating(false);
        }
    };

    const refreshSubscriptions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/subscriptions');
            const data = await res.json();
            if (data.subscriptions) {
                setSubscriptions(data.subscriptions.map((sub: any) => {
                    const now = new Date();
                    const expires = new Date(sub.expiresAt);
                    const isExpired = expires < now;
                    const daysRemaining = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    let expiryText = '';
                    if (isExpired) {
                        expiryText = expires.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                    } else {
                        expiryText = daysRemaining > 30 ? `${Math.floor(daysRemaining / 30)} ${t('accountPage.subs.monthsRemaining')}` : `${daysRemaining} ${t('accountPage.subs.daysRemaining')}`;
                    }
                    return {
                        ...sub,
                        id: sub.packageId,
                        pages: Array.isArray(sub.selectedPageIds) ? sub.selectedPageIds.length : 0,
                        maxPages: sub.pagesLimit ?? 3,
                        adAccounts: Array.isArray(sub.selectedAdAccountIds) ? sub.selectedAdAccountIds.length : 0,
                        maxAdAccounts: sub.adAccountsLimit ?? 5,
                        users: Array.isArray(sub.selectedUserIds) ? sub.selectedUserIds.length : 0,
                        maxUsers: sub.usersLimit ?? 1,
                        amount: sub.amount,
                        status: sub.status || (isExpired ? 'expired' : 'active'),
                        expiry: expiryText,
                        autoRenew: sub.autoRenew
                    };
                }));
            }
        } catch (e) {
            console.error('Failed to fetch subscriptions', e);
        } finally {
            setLoading(false);
        }
    }, [t]);

    // After returning from Stripe Checkout (Custom Plan payment): confirm and create subscription
    useEffect(() => {
        const sessionId = searchParams.get('session_id');
        if (!sessionId) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/stripe/confirm-custom-package', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId }),
                });
                const data = await res.json();
                if (cancelled) return;
                if (res.ok && data.success) {
                    await refreshSubscriptions();
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('session_id');
                    const qs = params.toString();
                    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
                } else if (!res.ok) {
                    setErrorMessage(data.error || t('accountPage.error.createFailed'));
                }
            } catch (e) {
                if (!cancelled) setErrorMessage(t('accountPage.error.general'));
            }
        })();
        return () => { cancelled = true; };
    }, [pathname, router, searchParams, refreshSubscriptions, t]);

    // Fetch Subscriptions
    useEffect(() => {
        refreshSubscriptions();
    }, [refreshSubscriptions]);

    const activeSubs = subscriptions.filter(s => s.status === 'active');
    const expiredSubs = subscriptions.filter(s => s.status === 'expired');

    // 14-Day Free Trial Logic (สำหรับผู้ใช้ที่มี subscription status = trial)
    const trialSub = subscriptions.find(s => s.status === 'trial');
    const isTrialActive = !!trialSub;

    // Memoize subscription to avoid ManageAccessContent re-fetching on every parent re-render
    const manageAccessSubscription = useMemo(() => {
        const sub = isTrialActive ? trialSub : activeSubs[0];
        if (!sub) return null;
        return {
            id: sub.id,
            maxPages: sub.maxPages ?? sub.pagesLimit ?? 0,
            maxUsers: sub.maxUsers ?? sub.usersLimit ?? 0,
            maxAdAccounts: sub.maxAdAccounts ?? sub.adAccountsLimit ?? 0,
            selectedPageIds: sub.selectedPageIds || [],
            selectedUserIds: sub.selectedUserIds || [],
            selectedAdAccountIds: sub.selectedAdAccountIds || [],
            amount: sub.amount ?? 0,
            autoRenew: sub.autoRenew ?? false,
            name: sub.name || '',
        };
    }, [isTrialActive, trialSub, activeSubs[0]]);
    const trialDaysRemaining = trialSub ? Math.max(0, Math.ceil((new Date(trialSub.expiresAt || trialSub.expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

    return (
        <div className="flex-1 w-full max-w-[1440px] mx-auto p-6 md:p-10 pb-20">
            {/* Create Plan Dialog */}
            <Dialog open={showPackageDialog} onOpenChange={(open) => {
                setShowPackageDialog(open);
                if (!open) {
                    setTimeout(() => cleanupDialogOverlays(), 100);
                }
            }}>
                <DialogContent className="max-w-4xl bg-white dark:bg-background border-border">
                    <DialogHeader>
                        <DialogTitle>{t('accountPage.package.createTitle')}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-section-title">{t('accountPage.package.selectPlan')}</h3>
                                <p className="text-sm text-muted-foreground">{t('accountPage.package.selectPlanDesc')}</p>
                            </div>
                            <div className="flex bg-zinc-100 dark:bg-muted p-1 rounded-lg">
                                {[3, 6, 12, 1].map((months) => (
                                    <button
                                        key={months}
                                        onClick={() => setSelectedDuration(months)}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${selectedDuration === months
                                            ? 'bg-background text-primary shadow-sm border border-border'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {months === 1 ? t('accountPage.package.monthly') : `${months} ${t('accountPage.package.months')}`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {PACKAGES.map((pkg) => {
                                const { total, original, discount } = calculatePrice(pkg.pages, pkg.users, selectedDuration, pkg.price);

                                // Determine Current Plan & Rank
                                const getPlanRank = (id: string) => {
                                    switch (id.toLowerCase()) {
                                        case 'free': return 0;
                                        case 'mini': return 1;
                                        case 'standard': return 2;
                                        case 'pro': return 3;
                                        default: return 0;
                                    }
                                };

                                let currentPlanId = 'free';
                                if (isTrialActive) currentPlanId = 'mini'; // Assuming trial is Standard/Mini
                                else if (activeSubs.length > 0) currentPlanId = activeSubs[0].id;

                                const currentRank = getPlanRank(currentPlanId);
                                const pkgRank = getPlanRank(pkg.id);

                                const isCurrentPlan = currentPlanId.toLowerCase() === pkg.id.toLowerCase();
                                const isUpgrade = pkgRank > currentRank;
                                const isDowngrade = pkgRank < currentRank;

                                return (
                                    <Card key={pkg.id} className={`relative p-6 border-2 transition-all hover:border-primary/50 cursor-pointer bg-card ${pkg.popular ? 'border-primary shadow-md ring-1 ring-primary/20' : 'border-border hover:shadow-md'}`}>
                                        {pkg.popular && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                                                {t('accountPage.package.mostPopular')}
                                            </div>
                                        )}

                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold text-lg text-foreground">{pkg.name}</h3>
                                                {pkg.tag && <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 border-0">{pkg.tag}</Badge>}
                                                {pkg.hasSupport && <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 border-0">{t('accountPage.package.fastSupport')}</Badge>}
                                            </div>
                                            <div className="space-y-2 text-sm text-muted-foreground">
                                                {pkg.features?.map((feature, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <Check className="w-4 h-4 text-green-500" /> {feature}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <div className="flex items-end gap-2 mb-1">
                                                <span className="text-3xl font-bold font-outfit text-foreground">${total.toLocaleString()}</span>
                                            </div>
                                            {discount > 0 && (
                                                <div className="text-sm text-muted-foreground line-through">
                                                    ${original.toLocaleString()}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-xs text-muted-foreground mb-6 min-h-[40px]">{pkg.description}</p>

                                        <Button
                                            className={`w-full ${pkg.popular ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'}`}
                                            onClick={() => createPackage(pkg.id, pkg.pages, pkg.users, selectedDuration, total, pkg.adAccounts)}
                                            disabled={creating || isCurrentPlan}
                                        >
                                            {creating
                                                ? t('accountPage.package.creating')
                                                : isCurrentPlan
                                                    ? "Current Plan"
                                                    : isDowngrade
                                                        ? `${t('accountPage.package.select', 'Downgrade to')} ${pkg.name}`
                                                        : `${t('accountPage.package.select', 'Upgrade to')} ${pkg.name}`
                                            }
                                        </Button>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Custom Plan Trigger */}
                        <div
                            className="bg-card border border-border rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-primary transition-colors group"
                            onClick={() => {
                                setShowPackageDialog(false);
                                setShowCustomDialog(true);
                            }}
                        >
                            <div className="flex items-center gap-2 text-primary font-medium group-hover:translate-x-1 transition-transform">
                                {t('accountPage.custom.title')}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Custom Plan Dialog */}
            <Dialog open={showCustomDialog} onOpenChange={(open) => {
                setShowCustomDialog(open);
                if (!open) {
                    setTimeout(() => cleanupDialogOverlays(), 100);
                }
            }}>
                <DialogContent className="max-w-4xl bg-white dark:bg-background p-0 gap-0 overflow-hidden">
                    <div className="flex flex-col md:flex-row h-full min-h-[550px]">
                        {/* Left Column: Plan Configuration */}
                        <div className="w-full md:w-[40%] bg-zinc-50 dark:bg-muted/20 p-6 border-r border-border space-y-6 flex flex-col overflow-y-auto max-h-[90vh]">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                                        <Layers className="w-6 h-6 text-primary" />
                                    </div>
                                    <DialogTitle className="text-dialog-title">{t('accountPage.custom.title')}</DialogTitle>
                                    <DialogDescription className="text-sm text-muted-foreground flex items-center gap-1">
                                        {t('accountPage.custom.subtitle')} <ChevronRight className="w-3 h-3" />
                                    </DialogDescription>
                                </div>

                                {/* Pages Input */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                                        <Label className="text-base font-semibold">{t('accountPage.custom.pages')}</Label>
                                    </div>
                                    <Select
                                        value={customPages.toString()}
                                        onValueChange={(v) => setCustomPages(parseInt(v))}
                                    >
                                        <SelectTrigger className="w-full h-10 rounded-lg bg-background border-border pl-10">
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                                <SelectValue placeholder={t('accountPage.custom.selectPages')} />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {RESOURCE_OPTIONS.map(opt => (
                                                <SelectItem key={opt} value={opt.toString()}>{opt} {t('accountPage.custom.pagesUnit')}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground px-1">{t('accountPage.custom.pagesDesc')}</p>
                                </div>

                                {/* Users Input */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        <Label className="text-base font-semibold">{t('accountPage.custom.users')}</Label>
                                    </div>
                                    <Select
                                        value={customUsers.toString()}
                                        onValueChange={(v) => setCustomUsers(parseInt(v))}
                                    >
                                        <SelectTrigger className="w-full h-10 rounded-lg bg-background border-border pl-10">
                                            <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                <SelectValue placeholder={t('accountPage.custom.selectUsers')} />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {RESOURCE_OPTIONS.map(opt => (
                                                <SelectItem key={opt} value={opt.toString()}>{opt} {t('accountPage.custom.usersUnit')}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground px-1">{t('accountPage.custom.usersDesc')}</p>
                                </div>

                                {/* Ad Accounts Input */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                                        <Label className="text-base font-semibold">{t('accountPage.custom.adAccounts')}</Label>
                                    </div>
                                    <Select
                                        value={customAdAccounts.toString()}
                                        onValueChange={(v) => setCustomAdAccounts(parseInt(v))}
                                    >
                                        <SelectTrigger className="w-full h-10 rounded-lg bg-background border-border pl-10">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                                                <SelectValue placeholder={t('accountPage.custom.selectAdAccounts')} />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {RESOURCE_OPTIONS.map(opt => (
                                                <SelectItem key={opt} value={opt.toString()}>{opt} {t('accountPage.custom.adAccountsUnit')}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground px-1">{t('accountPage.custom.adAccountsDesc')}</p>
                                </div>

                                {/* Duration Selector */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-muted-foreground" />
                                        <Label className="text-base font-semibold">{t('accountPage.custom.duration')}</Label>
                                    </div>
                                    <Select
                                        value={customDuration.toString()}
                                        onValueChange={(v) => setCustomDuration(parseInt(v))}
                                    >
                                        <SelectTrigger className="w-full h-10 rounded-lg bg-background border-border">
                                            <SelectValue placeholder={t('accountPage.custom.selectDuration')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1 {t('accountPage.package.months')}</SelectItem>
                                            <SelectItem value="3">3 {t('accountPage.package.months')} (-5%)</SelectItem>
                                            <SelectItem value="6">6 {t('accountPage.package.months')} (-15%)</SelectItem>
                                            <SelectItem value="12">12 {t('accountPage.package.months')} (-25%)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground px-1">{t('accountPage.custom.durationNote')}</p>
                                </div>
                            </div>

                            <div className="mt-auto pt-6 text-[10px] text-muted-foreground border-t border-border/50">
                                {t('accountPage.custom.monthNote')}
                            </div>
                        </div>

                        {/* Right Column: Payment & Summary */}
                        <div className="w-full md:w-[60%] p-6 bg-background flex flex-col h-full">
                            <h3 className="text-section-title mb-4 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-primary" /> {t('accountPage.custom.payment')}
                            </h3>

                            <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                                <div className="space-y-4">
                                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('accountPage.custom.selectPayment')}</Label>
                                    <Select
                                        value={selectedPaymentId}
                                        onValueChange={setSelectedPaymentId}
                                    >
                                        <SelectTrigger className="w-full h-12 rounded-lg border-2 border-primary/20 bg-muted/10">
                                            <div className="flex items-center gap-3">
                                                {selectedPaymentId === 'new' ? (
                                                    <CreditCard className="w-5 h-5" />
                                                ) : (
                                                    <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center text-[8px] font-bold text-primary uppercase">
                                                        {paymentMethods.find(pm => pm.id === selectedPaymentId)?.brand || 'CARD'}
                                                    </div>
                                                )}
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {paymentMethods.map(pm => (
                                                <SelectItem key={pm.id} value={pm.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-5 bg-muted rounded flex items-center justify-center text-[10px] font-bold uppercase">
                                                            {pm.brand}
                                                        </div>
                                                        <span>•••• {pm.last4}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="new">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-4 h-4 text-amber-500" />
                                                    <span>{t('accountPage.payment.addNew')}</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedPaymentId === 'new' && (
                                    <div className="bg-muted/30 p-6 rounded-lg border border-border animate-in fade-in slide-in-from-top-4 duration-300">
                                        {stripePromise ? (
                                            <Elements stripe={stripePromise}>
                                                <CardFormContent
                                                    onSuccess={() => {
                                                        fetch('/api/user/billing-data')
                                                            .then(res => res.json())
                                                            .then(data => {
                                                                if (data.paymentMethods && data.paymentMethods.length > 0) {
                                                                    setPaymentMethods(data.paymentMethods);
                                                                    // Set the newest card as selected
                                                                    setSelectedPaymentId(data.paymentMethods[data.paymentMethods.length - 1].id);
                                                                }
                                                            });
                                                    }}
                                                    onCancel={() => setSelectedPaymentId('new')}
                                                />
                                            </Elements>
                                        ) : (
                                            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                                <p className="text-destructive text-sm">
                                                    Stripe is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment variables.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-4 pt-6 border-t border-border">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">{t('accountPage.custom.quantity')} ({customPages} {t('accountPage.custom.pagesUnit')}, {customUsers} {t('accountPage.custom.usersUnit')}, {customAdAccounts} {t('accountPage.custom.adAccountsUnit')})</span>
                                        <span className="font-semibold text-foreground">${calculateCustomPrice().original.toLocaleString()}</span>
                                    </div>
                                    {calculateCustomPrice().original > calculateCustomPrice().total && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-green-600 font-medium">{t('accountPage.custom.durationDiscount')} ({Math.floor((1 - (DURATION_DISCOUNTS[customDuration] || 1)) * 100)}%)</span>
                                            <span className="text-green-600 font-bold">-${(calculateCustomPrice().original - calculateCustomPrice().total).toLocaleString()}</span>
                                        </div>
                                    )}
                                    <Separator className="my-2" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-bold text-foreground">{t('accountPage.custom.totalPayment')}</span>
                                        <div className="text-right">
                                            <span className="text-3xl font-black text-primary">${calculateCustomPrice().total.toLocaleString()}</span>
                                            <p className="text-[10px] text-muted-foreground mt-1 text-primary/70 font-medium">{t('accountPage.custom.specialPrice')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-10 rounded-lg text-sm"
                                    onClick={() => setShowCustomDialog(false)}
                                    disabled={creating}
                                >
                                    {t('accountPage.custom.cancel')}
                                </Button>
                                <Button
                                    onClick={() => createPackage('custom', customPages, customUsers, customDuration, calculateCustomPrice().total, customAdAccounts)}
                                    disabled={creating || selectedPaymentId === 'new'}
                                    className="flex-[2] h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('accountPage.custom.createPlan')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col lg:flex-row gap-6 w-full min-w-0">

                {/* Left Sidebar */}
                <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
                    <div className="glass-card p-6">
                        <div className="mb-8">
                            <h2 className="font-outfit font-bold text-xl tracking-tight text-foreground">{t('accountPage.sidebar.title')}</h2>
                            <p className="text-xs text-muted-foreground">{t('accountPage.sidebar.subtitle')}</p>
                        </div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 rounded-full bg-muted overflow-hidden">
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted-foreground/20 text-foreground">
                                        <User className="w-8 h-8" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-foreground truncate">
                                    {profileDisplay?.name || session?.user?.name || t('accountPage.sidebar.yourAccount')}
                                </h3>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate block">{profileDisplay?.email || session?.user?.email || '-'}</span>
                                </div>
                            </div>
                        </div>

                        <nav className="space-y-2">
                            {menuItems.map((item) => {
                                const isActive = activeTab === item.id;
                                const href = `${pathname}?tab=${item.id}`;
                                return (
                                    <Link
                                        key={item.id}
                                        href={href}
                                        className={`w-full flex items-start gap-4 p-3 rounded-lg text-left transition-all ${isActive
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <div className={`mt-0.5 p-1.5 rounded-lg ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">{item.label}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* Right Content - same container as connections page */}
                <div className="flex-1 min-w-0">
                    <div className="border border-border rounded-lg bg-card shadow-sm overflow-hidden">
                        <div className="h-full overflow-y-auto px-6 md:px-8 lg:px-10 py-6 md:py-8 space-y-6">
                            {activeTab === 'subscription' && (
                                <>
                                    {errorMessage && (
                                        <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20 text-sm flex items-center justify-between">
                                            <span>{errorMessage}</span>
                                            <button onClick={() => setErrorMessage(null)} className="text-destructive hover:opacity-80 ml-2">×</button>
                                        </div>
                                    )}

                                    {/* Active Subscriptions / Current Plan */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-5 h-5 text-muted-foreground" />
                                                <h2 className="text-section-title">{t('accountPage.subs.title')}</h2>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={refreshSubscriptions}
                                                    disabled={loading}
                                                >
                                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('accountPage.subs.refresh')}
                                                </Button>
                                            </div>
                                        </div>

                                        {loading && subscriptions.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                                                <p className="text-sm">{t('accountPage.subs.loading')}</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-6">
                                                {/* Current Plan Card */}
                                                <Card className="p-6 border-2 border-primary/20 bg-background/50 relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                                        <Layers className="w-32 h-32" />
                                                    </div>

                                                    <div className="relative z-10">
                                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                                            <div>
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <h3 className="text-page-title">
                                                                        {isTrialActive
                                                                            ? "Trial (Standard)"
                                                                            : activeSubs.length > 0
                                                                                ? activeSubs[0].name || activeSubs[0].id
                                                                                : "Free Plan"}
                                                                    </h3>
                                                                    {isTrialActive && (
                                                                        <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/30">
                                                                            {t('accountPage.subs.trial')}
                                                                        </Badge>
                                                                    )}
                                                                    {activeSubs.length > 0 && !isTrialActive && (
                                                                        <Badge variant="secondary" className="bg-green-500/20 text-green-600 hover:bg-green-500/30">
                                                                            {t('accountPage.subs.active')}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-muted-foreground">
                                                                    {isTrialActive
                                                                        ? `${t('accountPage.subs.free14Days')} - ${trialDaysRemaining} ${t('accountPage.subs.daysRemaining')}`
                                                                        : activeSubs.length > 0
                                                                            ? `${t('accountPage.subs.amount')}: $${activeSubs[0].amount.toLocaleString()}/${t('accountPage.package.monthly')}`
                                                                            : "Basic access with limited features"}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                onClick={() => setShowPackageDialog(true)}
                                                                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 px-6"
                                                            >
                                                                {isTrialActive
                                                                    ? "Upgrade Plan"
                                                                    : activeSubs.length > 0
                                                                        ? "Upgrade / Change Plan"
                                                                        : "Upgrade Plan"}
                                                            </Button>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border/50">
                                                            <div className="space-y-1">
                                                                <div className="text-sm text-muted-foreground">{t('accountPage.subs.pages')}</div>
                                                                <div className="text-xl font-semibold">
                                                                    {isTrialActive ? trialSub?.pages : activeSubs.length > 0 ? activeSubs[0].pages : 0}
                                                                    <span className="text-muted-foreground text-sm font-normal"> / {isTrialActive ? trialSub?.maxPages : activeSubs.length > 0 ? activeSubs[0].maxPages : 10}</span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="text-sm text-muted-foreground">{t('accountPage.subs.adAccounts')}</div>
                                                                <div className="text-xl font-semibold">
                                                                    {isTrialActive ? trialSub?.adAccounts : activeSubs.length > 0 ? activeSubs[0].adAccounts : 0}
                                                                    <span className="text-muted-foreground text-sm font-normal"> / {isTrialActive ? trialSub?.maxAdAccounts : activeSubs.length > 0 ? activeSubs[0].maxAdAccounts : 10}</span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="text-sm text-muted-foreground">{t('accountPage.subs.users')}</div>
                                                                <div className="text-xl font-semibold">
                                                                    {isTrialActive ? trialSub?.users : activeSubs.length > 0 ? activeSubs[0].users : 0}
                                                                    <span className="text-muted-foreground text-sm font-normal"> / {isTrialActive ? trialSub?.maxUsers : activeSubs.length > 0 ? activeSubs[0].maxUsers : 5}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Card>

                                                {/* Manage Resources Section - Integrated from Manage Access */}
                                                {manageAccessSubscription && (
                                                    <Card className="p-6 border border-border bg-card">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                                <Settings2 className="w-5 h-5 text-primary" />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-foreground">
                                                                    {t('settings.manageResources', 'Manage Resources')}
                                                                </h3>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {t('settings.manageResourcesDesc', 'Configure which pages, ad accounts and team members can access your subscription')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        <ManageAccessContent
                                                            subscription={manageAccessSubscription}
                                                            initialTab="pages"
                                                            onSaved={() => refreshSubscriptions()}
                                                        />
                                                    </Card>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                </>
                            )}


                                            {activeTab === 'payment-billing' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-6">
                                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                                        <h2 className="text-section-title">{t('accountPage.menu.paymentAndBilling', 'Payment & Billing')}</h2>
                                    </div>

                                    <Tabs value={paymentSubTab} onValueChange={(value) => {
                                        setPaymentSubTab(value as 'payment' | 'invoices');
                                        router.push(`${pathname}?tab=payment-billing&subtab=${value}`);
                                    }} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 mb-6">
                                            <TabsTrigger value="payment" className="flex items-center gap-2">
                                                <CreditCard className="w-4 h-4" />
                                                {t('accountPage.payment.title')}
                                            </TabsTrigger>
                                            <TabsTrigger value="invoices" className="flex items-center gap-2">
                                                <FileText className="w-4 h-4" />
                                                {t('accountPage.invoices.title')}
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="payment" className="space-y-6 mt-0">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                                                    <h3 className="text-base font-semibold text-foreground">{t('accountPage.payment.title')}</h3>
                                                </div>
                                                {!showAddCardForm && (
                                                    <Button onClick={() => setShowAddCardForm(true)} variant="outline">
                                                        {t('accountPage.payment.addCard')}
                                                    </Button>
                                                )}
                                            </div>

                                            {errorMessage && (
                                                <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 text-sm">
                                                    {errorMessage}
                                                </div>
                                            )}

                                            {showAddCardForm ? (
                                                <div className="bg-muted/30 p-6 rounded-lg border border-border">
                                                    {stripePromise ? (
                                                        <Elements stripe={stripePromise}>
                                                            <CardFormContent
                                                                onSuccess={() => {
                                                                    setShowAddCardForm(false);
                                                                    fetch('/api/user/billing-data')
                                                                        .then(res => res.json())
                                                                        .then(data => {
                                                                            if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
                                                                        });
                                                                }}
                                                                onCancel={() => setShowAddCardForm(false)}
                                                            />
                                                        </Elements>
                                                    ) : (
                                                        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                                            <p className="text-destructive text-sm">
                                                                Stripe is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment variables.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {billingDataLoading ? (
                                                        <div className="flex justify-center p-8">
                                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                                        </div>
                                                    ) : paymentMethods.length === 0 ? (
                                                        <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                                                            {t('accountPage.payment.noCards')}
                                                        </div>
                                                    ) : (
                                                        paymentMethods.map((pm) => (
                                                            <div key={pm.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-8 bg-muted rounded flex items-center justify-center text-xs font-bold text-muted-foreground capitalize">
                                                                        {pm.brand}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-medium text-foreground">•••• •••• •••• {pm.last4}</div>
                                                                        <div className="text-xs text-muted-foreground">{t('accountPage.payment.expires')} {pm.expMonth}/{pm.expYear}</div>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleDeletePayment(pm.id)}
                                                                    disabled={deletingPaymentId === pm.id}
                                                                >
                                                                    {deletingPaymentId === pm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                                </Button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="invoices" className="space-y-6 mt-0">
                                            <div className="flex items-center gap-2 mb-6">
                                                <FileText className="w-5 h-5 text-muted-foreground" />
                                                <h3 className="text-base font-semibold text-foreground">{t('accountPage.invoices.title')}</h3>
                                            </div>

                                            {billingDataLoading ? (
                                                <div className="flex justify-center p-8">
                                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="text-left text-xs font-semibold text-muted-foreground border-b border-border">
                                                                <th className="pb-4 pl-4">{t('accountPage.invoices.number')}</th>
                                                                <th className="pb-4">{t('accountPage.invoices.date')}</th>
                                                                <th className="pb-4">{t('accountPage.invoices.amount')}</th>
                                                                <th className="pb-4">{t('accountPage.invoices.status')}</th>
                                                                <th className="pb-4 text-right pr-4">{t('accountPage.invoices.receipt')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="text-sm">
                                                            {invoices.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={5} className="text-center py-8 text-muted-foreground">{t('accountPage.invoices.noHistory')}</td>
                                                                </tr>
                                                            ) : (
                                                                invoices.map((inv) => (
                                                                    <tr key={inv.id} className="border-b border-border hover:bg-muted/30 transition-colors last:border-0">
                                                                        <td className="py-4 pl-4 font-medium text-foreground">{inv.number}</td>
                                                                        <td className="py-4 text-muted-foreground">
                                                                            {inv.created ? new Date(inv.created).toLocaleDateString('th-TH', {
                                                                                year: 'numeric',
                                                                                month: 'short',
                                                                                day: 'numeric'
                                                                            }) : '-'}
                                                                        </td>
                                                                        <td className="py-4 font-medium text-foreground">
                                                                            {inv.amountPaid.toLocaleString('th-TH', { minimumFractionDigits: 2 })} {inv.currency.toUpperCase()}
                                                                        </td>
                                                                        <td className="py-4">
                                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${inv.status === 'paid' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                                                                                inv.status === 'open' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                                                                    'bg-muted text-muted-foreground'
                                                                                }`}>
                                                                                {inv.status}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-4 text-right pr-4">
                                                                            {(inv.invoicePdf || inv.hostedInvoiceUrl) && (
                                                                                <a
                                                                                    href={inv.invoicePdf || inv.hostedInvoiceUrl!}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-primary hover:text-primary/80 text-xs font-medium inline-flex items-center gap-1"
                                                                                >
                                                                                    {t('accountPage.invoices.download')} <FileText className="w-3 h-3" />
                                                                                </a>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            )}

                            {activeTab === 'profile' && <ProfileSettings />}
                            {activeTab === 'sessions' && <SessionManagement />}
                            {activeTab === 'team' && <TeamSettings />}
                            {activeTab === 'appearance' && <AppearanceSettings />}
                            {activeTab === 'advanced' && <DeleteAccountSettings />}
                        </div>
                    </div>
                </div>
            </div>


            {/* Payment Confirmation Dialog */}
            <AlertDialog open={showConfirmDialog} onOpenChange={(open) => {
                setShowConfirmDialog(open);
                if (!open) {
                    setTimeout(() => cleanupDialogOverlays(), 100);
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('accountPage.package.confirmPayment', 'Confirm Payment')}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                        {pendingPackage && (
                            <>
                                <div className="space-y-2">
                                    <p className="font-semibold text-foreground">{t('accountPage.package.packageDetails', 'Package Details')}</p>
                                    <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('accountPage.package.pages')}:</span>
                                            <span className="font-medium">{pendingPackage.pages}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('accountPage.package.users')}:</span>
                                            <span className="font-medium">{pendingPackage.users}</span>
                                        </div>
                                        {pendingPackage.adAccountsLimit && pendingPackage.adAccountsLimit > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">{t('accountPage.package.adAccounts')}:</span>
                                                <span className="font-medium">{pendingPackage.adAccountsLimit}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('accountPage.package.duration')}:</span>
                                            <span className="font-medium">{pendingPackage.months} {pendingPackage.months === 1 ? t('accountPage.package.month') : t('accountPage.package.months')}</span>
                                        </div>
                                        <Separator className="my-2" />
                                        <div className="flex justify-between text-base font-semibold">
                                            <span>{t('accountPage.package.total')}:</span>
                                            <span className="text-primary">฿{pendingPackage.amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                {paymentMethods.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="font-semibold text-foreground">{t('accountPage.payment.paymentMethod', 'Payment Method')}</p>
                                        <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
                                            <CreditCard className="w-5 h-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium text-sm capitalize">
                                                    {paymentMethods[0].brand} •••• {paymentMethods[0].last4}
                                                </p>
                                                {paymentMethods[0].expMonth && paymentMethods[0].expYear && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {t('accountPage.payment.expires', 'Expires')} {String(paymentMethods[0].expMonth).padStart(2, '0')}/{String(paymentMethods[0].expYear).slice(-2)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={creating} onClick={() => {
                            setShowConfirmDialog(false);
                            setPendingPackage(null);
                        }}>
                            {t('common.cancel', 'Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={creating}
                            onClick={async () => {
                                if (!pendingPackage) return;
                                setShowConfirmDialog(false);
                                await processPackagePayment(
                                    pendingPackage.packageId,
                                    pendingPackage.pages,
                                    pendingPackage.users,
                                    pendingPackage.months,
                                    pendingPackage.amount,
                                    pendingPackage.adAccountsLimit,
                                    pendingPackage.packageName,
                                    pendingPackage.packageType
                                );
                                setPendingPackage(null);
                            }}
                            className="bg-primary hover:bg-primary/90 min-w-[120px]"
                        >
                            {creating ? (
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
        </div >
    );
}
