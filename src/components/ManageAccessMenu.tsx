'use client';

import { useState, useEffect } from 'react';
import {
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { LayoutPanelTop, Megaphone, Users, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
interface ManageAccessMenuProps {
    // No props needed now
}

export function ManageAccessMenu({ }: ManageAccessMenuProps) {
    const { t } = useLanguage();
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(false);

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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    // No handleOpen needed

    if (subscriptions.length === 0 && !loading) return null;

    return (
        <DropdownMenuItem asChild className="rounded-lg cursor-pointer focus:bg-primary/10 focus:text-primary py-2 px-2">
            <Link href="/settings?tab=subscription" className="flex items-center w-full">
                <ShieldCheck className="mr-2 h-4 w-4 text-sky-500" />
                <span>{t('header.manageAccess', 'Manage Access')}</span>
            </Link>
        </DropdownMenuItem>
    );
}
