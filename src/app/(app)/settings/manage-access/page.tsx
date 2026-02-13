'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ManageAccessContent } from '@/components/settings/ManageAccessContent';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { LayoutPanelTop } from 'lucide-react';

function ManageAccessPageContent() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'subscription';

    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/subscriptions');
            const data = await res.json();
            if (data.subscriptions && data.subscriptions.length > 0) {
                const mapped = data.subscriptions.map((sub: any) => {
                    return {
                        ...sub,
                        id: sub.packageId,
                        pages: sub.selectedPageIds?.length || 0,
                        maxPages: sub.pagesLimit ?? 3,
                        adAccounts: sub.selectedAdAccountIds?.length || 0,
                        maxAdAccounts: sub.adAccountsLimit ?? 5,
                        users: sub.selectedUserIds?.length || 0,
                        maxUsers: sub.usersLimit ?? 1,
                        amount: sub.amount,
                    };
                });
                setSubscriptions(mapped);
                setSelectedSubscription(mapped[0]);
            }
        } catch (e) {
            console.error('Failed to fetch subscriptions:', e);
            toast({
                title: t('common.error', 'Error'),
                description: t('subDialog.loadError', 'Failed to load subscription data'),
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!selectedSubscription) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center p-4">
                <LayoutPanelTop className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <h2 className="text-xl font-semibold mb-2">{t('subDialog.noData', 'No Data')}</h2>
                <p className="text-muted-foreground max-w-md">
                    {t('settings.noSubscriptionFound', 'We couldn\'t find an active subscription for your account.')}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-white dark:bg-background rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/5">
                <h1 className="text-page-title">{t('header.manageAccess', 'Manage Access')}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {t('settings.manageAccessDesc', 'Configure your pages, ad accounts, and team members for this subscription package.')}
                </p>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6">
                <ManageAccessContent
                    subscription={selectedSubscription}
                    initialTab={initialTab}
                    onSaved={() => {
                        toast({
                            title: t('common.success', 'Success'),
                            description: t('settings.savedSuccessfully', 'Settings saved successfully'),
                        });
                    }}
                />
            </div>
        </div>
    );
}

export default function ManageAccessPage() {
    return (
        <div className="container mx-auto py-8 px-4 max-w-5xl">
            <Suspense fallback={
                <div className="flex-1 flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            }>
                <ManageAccessPageContent />
            </Suspense>
        </div>
    );
}
