'use client';

import { showCustomToast } from "@/utils/custom-toast";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, ExternalLink, CreditCard, Building2, Edit3, RotateCcw, Trash2, MoreHorizontal, ArrowUp, ArrowDown, ArrowUpDown, PlusCircle } from "lucide-react";
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdAccount } from '@/contexts/AdAccountContext';
import { formatCurrencyByCode, getCurrencySymbol } from '@/lib/currency-utils';

interface AdAccount {
    id: string;
    name: string;
    account_id: string;
    businessName?: string;
    businessProfilePictureUri?: string;
    status: string | number; // Can be string or number from API
    disable_reason?: string;
    activeAds: number;
    spendingCap: number | null;
    spentAmount: number | null;
    timeZone: string;
    timeZoneOffset?: number;
    nationality: string;
    currency: string;
    paymentMethod?: string;
}

export interface AccountsTabProps {
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    refreshTrigger?: number;
    searchQuery?: string;
}

export function AccountsTab({ selectedIds, onSelectionChange, refreshTrigger = 0, searchQuery = '' }: AccountsTabProps) {
    const { t, language } = useLanguage();
    const { data: session } = useSession();
    const { selectedAccounts } = useAdAccount();
    const [accounts, setAccounts] = useState<AdAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Selection handlers
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(new Set(accounts.map(a => a.id)));
        } else {
            onSelectionChange(new Set());
        }
    };

    const handleSelectOne = (accountId: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(accountId);
        } else {
            newSelected.delete(accountId);
        }
        onSelectionChange(newSelected);
    };

    const isAllSelected = accounts.length > 0 && accounts.every(a => selectedIds.has(a.id));
    const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

    // Spending limit dialog state
    const [spendingLimitDialogOpen, setSpendingLimitDialogOpen] = useState(false);
    const [selectedAccountForLimit, setSelectedAccountForLimit] = useState<AdAccount | null>(null);
    const [spendingLimitAction, setSpendingLimitAction] = useState<'change' | 'reset'>('change');
    const [newLimitValue, setNewLimitValue] = useState('');
    const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

    // Helper function to get detailed status display
    // Helper function to get detailed status display
    const getAccountStatus = (account: AdAccount) => {
        const status = typeof account.status === 'string' ? parseInt(account.status) : account.status;
        const disableReason = typeof account.disable_reason === 'string' ? parseInt(account.disable_reason) : account.disable_reason;

        // Map Facebook account_status to display
        let statusText = 'Unknown';
        let statusColor = 'bg-yellow-500';
        let textColor = 'text-yellow-700 dark:text-yellow-400';

        if (status === 1) {
            // Active
            // Check for spending limit reached (only if there's an actual limit set)
            if (Number(account.spendingCap) > 0 && Number(account.spentAmount) >= Number(account.spendingCap)) {
                statusText = 'Spending Limit Reached';
                statusColor = 'bg-red-500';
                textColor = 'text-red-700 dark:text-red-400';
            } else {
                statusText = 'Active';
                statusColor = 'bg-green-500';
                textColor = 'text-green-700 dark:text-green-400';
            }
        } else if (status === 2) {
            // Disabled - check disable_reason (0=NONE, 1=POLICY, 2=RISK_PAYMENT)
            if (disableReason === 1) {
                statusText = 'Disapproved'; // POLICY
                statusColor = 'bg-red-500';
                textColor = 'text-red-700 dark:text-red-400';
            } else if (disableReason === 2) {
                statusText = 'Payment Issue'; // RISK_PAYMENT
                statusColor = 'bg-orange-500';
                textColor = 'text-orange-700 dark:text-orange-400';
            } else {
                statusText = 'Disabled';
                statusColor = 'bg-red-500';
                textColor = 'text-red-700 dark:text-red-400';
            }
        } else if (status === 3) {
            // Unsettled
            statusText = 'Unsettled';
            statusColor = 'bg-orange-500';
            textColor = 'text-orange-700 dark:text-orange-400';
        } else if (status === 7) {
            // Pending Risk Review
            statusText = 'Pending Review';
            statusColor = 'bg-yellow-500';
            textColor = 'text-yellow-700 dark:text-yellow-400';
        } else if (status === 8) {
            // Pending Settlement
            statusText = 'Pending Settlement';
            statusColor = 'bg-orange-500';
            textColor = 'text-orange-700 dark:text-orange-400';
        } else if (status === 9) {
            // In Grace Period
            statusText = 'Grace Period';
            statusColor = 'bg-orange-500';
            textColor = 'text-orange-700 dark:text-orange-400';
        } else if (status === 101) {
            // Closed
            statusText = 'Closed';
            statusColor = 'bg-gray-500';
            textColor = 'text-gray-700 dark:text-gray-400';
        }

        return { statusText, statusColor, textColor };
    };

    // Set loading state based on accounts data
    useEffect(() => {
        // Start with loading true, will be set to false after API fetch
        if (selectedAccounts.length > 0 && accounts.length === 0) {
            setIsLoadingAccounts(true);
        }
    }, [selectedAccounts, accounts]);

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        direction: 'asc' | 'desc' | null;
    }>({ key: null, direction: null });

    // Sorting handlers
    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev.key !== key) {
                return { key, direction: 'asc' };
            }
            if (prev.direction === 'asc') {
                return { key, direction: 'desc' };
            }
            return { key: null, direction: null };
        });
    };

    const sortData = <T extends Record<string, any>>(data: T[]): T[] => {
        if (!sortConfig.key || !sortConfig.direction) return data;

        return [...data].sort((a, b) => {
            const aVal = a[sortConfig.key!];
            const bVal = b[sortConfig.key!];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (aVal === bVal) return 0;
            const comparison = aVal > bVal ? 1 : -1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    };

    // Sortable Header Component
    const SortableHeader = ({
        columnKey,
        label,
        align = 'left',
        className = ''
    }: {
        columnKey: string;
        label: string;
        align?: 'left' | 'right' | 'center';
        className?: string;
    }) => {
        const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : '';

        return (

            <TableHead
                className={`py-2 text-${align} text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${className}`}
                onClick={() => handleSort(columnKey)}
            >
                <div className={`flex items-center gap-1 ${justifyClass}`}>
                    {label}
                    {sortConfig.key === columnKey && sortConfig.direction === 'asc' && <ArrowUp className="h-3 w-3" />}
                    {sortConfig.key === columnKey && sortConfig.direction === 'desc' && <ArrowDown className="h-3 w-3" />}
                    {sortConfig.key !== columnKey && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
            </TableHead>
        );
    };

    // Fetch accounts from Facebook API
    const fetchAccounts = async () => {
        if (!session?.user || selectedAccounts.length === 0) {
            return;
        }

        setIsLoadingAccounts(true);
        setLoading(true);
        try {
            const response = await fetch('/api/team/ad-accounts' + (refreshTrigger > 0 ? '?refresh=true' : ''));

            if (response.ok) {
                const data = await response.json();
                const fbAccounts = data.accounts || [];



                // Map Facebook accounts with selected accounts
                const enrichedAccounts = selectedAccounts.map(acc => {
                    const fbAccount = fbAccounts.find((fb: any) => fb.account_id === acc.account_id);

                    return {
                        id: acc.id,
                        name: acc.name,
                        account_id: acc.account_id,
                        businessName: fbAccount?.business_name || '-',
                        businessProfilePictureUri: fbAccount?.business_profile_picture_uri,
                        status: fbAccount?.account_status ?? 'UNKNOWN',
                        disable_reason: fbAccount?.disable_reason,
                        activeAds: fbAccount?.ads?.summary?.total_count || 0,
                        spendingCap: fbAccount?.spend_cap || null,
                        spentAmount: fbAccount?.amount_spent || null,
                        timeZone: fbAccount?.timezone_name || '-',
                        timeZoneOffset: fbAccount?.timezone_offset_hours_utc ?? fbAccount?.timezone_offset,
                        nationality: fbAccount?.business_country_code || '-',
                        currency: fbAccount?.currency || '-',
                        paymentMethod: fbAccount?.funding_source_details?.display_string || fbAccount?.funding_source_details?.type || '-',
                    };
                });

                setAccounts(enrichedAccounts);
                setIsLoadingAccounts(false);
            } else {
                console.error('Failed to fetch accounts from Facebook');
                setIsLoadingAccounts(false);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            setIsLoadingAccounts(false);
        } finally {
            setLoading(false);
        }
    };

    // Fetch real data from Facebook on mount
    // Track if we have done the initial fetch
    const [hasInitialFetch, setHasInitialFetch] = useState(false);

    // Fetch real data from Facebook
    // Modified to STRICTLY follow user request: "Only refresh when button clicked" (after initial load)
    useEffect(() => {
        if (!session?.user) return;

        // Condition 1: Initial Load (only if we haven't fetched yet and have accounts to fetch)
        const isInitialLoad = !hasInitialFetch && selectedAccounts.length > 0;

        // Condition 2: Manual Refresh (refreshTrigger increased)
        // We use a ref to track prev trigger if needed, or just rely on the effect running when it changes.
        // Since refreshTrigger starts at 0, we can assume any change is a request.
        // But we need to distinguish mount (0) vs update. 
        // Actually, logic is simpler: 
        // If refreshTrigger changes, FORCE fetch.
        // If selectedAccounts changes, DO NOT fetch (unless it's the very first load).

        if (isInitialLoad) {
            fetchAccounts().finally(() => setHasInitialFetch(true));
        }
    }, [selectedAccounts, session]); // Dependencies for Initial Load checking

    // Separate effect for Manual Refresh to ensure it always runs on click
    useEffect(() => {
        if (refreshTrigger > 0 && session?.user && selectedAccounts.length > 0) {
            fetchAccounts();
        }
    }, [refreshTrigger]);

    // Spending limit handlers
    const openSpendingLimitDialog = (account: AdAccount) => {
        setSelectedAccountForLimit(account);
        setSpendingLimitAction('change');
        setNewLimitValue(account.spendingCap?.toString() || '');
        setSpendingLimitDialogOpen(true);
    };

    const handleSpendingLimitAction = async (account: AdAccount, action: 'change' | 'reset' | 'delete') => {
        if (action === 'change') {
            openSpendingLimitDialog(account);
            return;
        }

        const confirmMessage = action === 'reset'
            ? t('accounts.spendingLimit.confirm.reset', `Reset spending for ${account.name}?`).replace('{name}', account.name)
            : t('accounts.spendingLimit.confirm.delete', `Delete limit for ${account.name}?`).replace('{name}', account.name);

        if (!confirm(confirmMessage)) return;

        setIsUpdatingLimit(true);
        try {
            const response = await fetch('/api/ads/spending-limit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: account.account_id,
                    action,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update spending limit');
            }

            // Refresh accounts
            await fetchAccounts();
            alert(action === 'reset'
                ? t('accounts.spendingLimit.success.reset', 'Limit reset successfully!')
                : t('accounts.spendingLimit.success.delete', 'Limit deleted successfully!')
            );
        } catch (err: any) {
            alert(err.message || 'เกิดข้อผิดพลาด');
        } finally {
            setIsUpdatingLimit(false);
        }
    };

    const handleSaveSpendingLimit = async () => {
        if (!selectedAccountForLimit) return;

        // Validation for change action
        if (spendingLimitAction === 'change' && (!newLimitValue || parseFloat(newLimitValue) <= 0)) {
            showCustomToast(t('accounts.spendingLimit.error.invalid', 'Please enter a valid amount'));
            return;
        }

        setIsUpdatingLimit(true);
        try {
            const response = await fetch('/api/ads/spending-limit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: selectedAccountForLimit.account_id,
                    action: spendingLimitAction,
                    newLimit: spendingLimitAction === 'change' ? newLimitValue : undefined,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update spending limit');
            }

            setSpendingLimitDialogOpen(false);
            await fetchAccounts();

            const message = spendingLimitAction === 'reset'
                ? `รีเซ็ตวงเงินสำหรับ ${selectedAccountForLimit.name} แล้ว`
                : `อัพเดตวงเงินเป็น ${newLimitValue} ${selectedAccountForLimit.currency} สำหรับ ${selectedAccountForLimit.name}`;
            showCustomToast(message);
        } catch (err: any) {
            showCustomToast(err.message || 'เกิดข้อผิดพลาดในการอัพเดตวงเงิน');
        } finally {
            setIsUpdatingLimit(false);
        }
    };

    // Generate skeleton rows for loading state
    const SkeletonRow = () => (
        <TableRow className="border-b border-gray-200 dark:border-zinc-800">

            <TableCell className="px-4 py-2">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-zinc-700 animate-pulse flex-shrink-0" />
                    <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
            </TableCell>
            <TableCell className="px-4 py-2">
                <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
            </TableCell>
            <TableCell className="px-4 py-2">
                <div className="h-4 w-16 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
            </TableCell>
            <TableCell className="px-4 py-2 text-center">
                <div className="h-5 w-10 bg-gray-200 dark:bg-zinc-700 rounded-full animate-pulse mx-auto" />
            </TableCell>

            <TableCell className="px-4 py-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
            </TableCell>
            <TableCell className="px-4 py-2">
                <div className="h-4 w-28 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
            </TableCell>
            <TableCell className="px-4 py-2 text-center">
                <div className="h-4 w-8 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse mx-auto" />
            </TableCell>
            <TableCell className="px-4 py-2 text-center">
                <div className="h-5 w-12 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse mx-auto" />
            </TableCell>
            <TableCell className="px-4 py-2 text-right">
                <div className="h-4 w-16 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse ml-auto" />
            </TableCell>
            <TableCell className="px-4 py-2 text-center">
                <div className="h-6 w-6 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse mx-auto" />
            </TableCell>
        </TableRow>
    );

    if (loading && accounts.length === 0) {
        // Show skeleton table instead of centered loading spinner
        return (
            <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 overflow-hidden flex-1 flex flex-col min-h-0 rounded-xl">
                <div className="overflow-auto flex-1 [&>div]:overflow-visible">
                    <Table className="min-w-max">
                        <TableHeader className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-50">
                            <TableRow>
                                <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.businessAccount', 'Business Account')}</TableHead>
                                <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.accountName')}</TableHead>
                                <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.status')}</TableHead>
                                <TableHead className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.activeAds', 'Active Ads')}</TableHead>
                                <TableHead className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.spendingCap', 'Spending Cap')}</TableHead>
                                <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.paymentMethod', 'Payment Method')}</TableHead>
                                <TableHead className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.timezone', 'Time Zone')}</TableHead>
                                <TableHead className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.nationality', 'Nationality')}</TableHead>
                                <TableHead className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.currency', 'Currency')}</TableHead>
                                <TableHead className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900">{t('accounts.table.action', 'Action')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => <SkeletonRow key={i} />)}
                        </TableBody>
                    </Table>
                </div>

            </div>

        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error || t('accounts.error', 'Failed to load accounts')}</p>
                    <Button onClick={fetchAccounts}>{t('accounts.tryAgain', 'Try Again')}</Button>
                </div>
            </div>
        );
    }

    if (!loading && selectedAccounts.length === 0) {
        return (
            <div className="p-12">
                <div className="text-center">
                    <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('accounts.noSelectedTitle', 'No Ad Accounts Selected')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                        {t('accounts.noSelectedDesc', 'Please select at least one ad account in Settings to view account details.')}
                    </p>
                    <Link href="/settings?tab=ad-accounts">
                        <Button>{t('accounts.goToSettings', 'Go to Settings')}</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 overflow-hidden flex-1 flex flex-col min-h-0 rounded-xl">
                <div className="overflow-auto flex-1 [&>div]:overflow-visible">
                    <Table className="min-w-max">
                        <TableHeader className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-50">
                            <TableRow>
                                <SortableHeader columnKey="businessName" label={t('accounts.table.businessAccount', 'Business Account')} align="left" className="max-w-[200px]" />
                                <SortableHeader columnKey="name" label={t('accounts.table.accountName')} align="left" className="max-w-[280px]" />
                                <SortableHeader columnKey="status" label={t('accounts.table.status')} align="left" className="max-w-[280px]" />
                                <SortableHeader columnKey="activeAds" label={t('accounts.table.activeAds', 'Active Ads')} align="center" className="max-w-[280px]" />
                                <SortableHeader columnKey="spendingCap" label={t('accounts.table.spendingCap', 'Spending Cap')} align="right" className="max-w-[280px] pr-12" />
                                <SortableHeader columnKey="paymentMethod" label={t('accounts.table.paymentMethod', 'Payment Method')} align="left" className="max-w-[280px]" />
                                <SortableHeader columnKey="timeZone" label={t('accounts.table.timezone', 'Time Zone')} align="right" className="max-w-[280px]" />
                                <SortableHeader columnKey="nationality" label={t('accounts.table.nationality', 'Nationality')} align="center" className="max-w-[280px]" />
                                <SortableHeader columnKey="currency" label={t('accounts.table.currency', 'Currency')} align="center" className="max-w-[280px]" />
                                <TableHead className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 max-w-[280px]">
                                    {t('accounts.table.action', 'Action')}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-gray-200 dark:divide-zinc-800 border-b border-gray-200 dark:border-zinc-800">
                            {sortData(accounts.filter(a =>
                                a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                a.account_id.includes(searchQuery)
                            )).map((account, index) => (
                                <TableRow key={account.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-gray-200 dark:border-zinc-800 cursor-pointer" onClick={() => handleSelectOne(account.id, !selectedIds.has(account.id))}>
                                    <TableCell className="px-4 py-2">
                                        <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
                                            {account.businessProfilePictureUri ? (
                                                <img
                                                    src={account.businessProfilePictureUri}
                                                    alt={account.businessName || ''}
                                                    className="w-8 h-8 rounded-full border flex-shrink-0 object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
                                                    {(account.businessName || '-').substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate" title={account.businessName}>
                                                {account.businessName}
                                            </span>
                                        </div>
                                    </TableCell>


                                    <TableCell className="px-4 py-2">
                                        <div className="flex items-center gap-2 group">
                                            <div className="text-sm text-gray-900 dark:text-gray-100">{account.name}</div>
                                            <Link
                                                href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${account.account_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <ExternalLink className="h-3 w-3 text-gray-400 hover:text-blue-600" />
                                            </Link>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-500 font-mono mt-0.5">ID: {account.account_id}</div>
                                    </TableCell>
                                    <TableCell className="px-4 py-2">
                                        {isLoadingAccounts ? (
                                            <div className="h-5 w-16 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                                        ) : (() => {
                                            const { statusText, statusColor, textColor } = getAccountStatus(account);
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                                                    <span className={`text-sm ${textColor}`}>
                                                        {statusText}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-center">
                                        {isLoadingAccounts ? (
                                            <div className="h-5 w-12 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse mx-auto" />
                                        ) : (
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-medium">
                                                {account.activeAds}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell
                                        className="px-4 py-2 cursor-pointer group hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (account.spendingCap) {
                                                handleSpendingLimitAction(account, 'change');
                                            }
                                        }}
                                    >
                                        {isLoadingAccounts ? (
                                            <div className="h-5 w-20 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                                        ) : (Number(account.spendingCap) > 0) ? (
                                            <div className="flex items-center gap-2 justify-end">
                                                {/* Amount */}
                                                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                    {formatCurrencyByCode(Number(account.spentAmount || 0), account.currency || 'USD', { maximumFractionDigits: 2 })}
                                                </span>

                                                {/* Progress Bar with Tooltip */}
                                                <div className="w-[60%] relative">
                                                    <Progress
                                                        value={Number(account.spendingCap) > 0 ? ((Number(account.spentAmount) || 0) / Number(account.spendingCap)) * 100 : 0}
                                                        className={`h-1.5 w-full [&>div]:transition-colors ${(Number(account.spendingCap) > 0 ? ((Number(account.spentAmount) || 0) / Number(account.spendingCap)) * 100 : 0) >= 100 ? '[&>div]:bg-red-500' :
                                                            (Number(account.spendingCap) > 0 ? ((Number(account.spentAmount) || 0) / Number(account.spendingCap)) * 100 : 0) >= 80 ? '[&>div]:bg-orange-500' :
                                                                '[&>div]:bg-green-500'
                                                            }`}
                                                    />

                                                    {/* Custom Black Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#0F172A] text-white text-[11px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg select-none">
                                                        {formatCurrencyByCode(Number(account.spentAmount || 0), account.currency || 'USD', { maximumFractionDigits: 2 })} / {formatCurrencyByCode(Number(account.spendingCap || 0), account.currency || 'USD', { maximumFractionDigits: 2 })}
                                                        {/* Triangle/Arrow */}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0F172A]"></div>
                                                    </div>
                                                </div>

                                                {/* Percentage */}
                                                <span className="text-xs text-gray-500 dark:text-gray-400 w-9 text-right font-medium">
                                                    {Math.round(Number(account.spendingCap) > 0 ? ((Number(account.spentAmount) || 0) / Number(account.spendingCap)) * 100 : 0)}%
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                                    {t('accounts.noLimit', 'No Limit')}
                                                </span>
                                                <button
                                                    className="text-xs text-blue-600 hover:text-blue-700 dark:hover:text-blue-500 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openSpendingLimitDialog(account);
                                                    }}
                                                    title={t('accounts.actions.setLimit', 'Set Limit')}
                                                >
                                                    <PlusCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-4 py-2">
                                        {isLoadingAccounts ? (
                                            <div className="h-5 w-24 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                                        ) : (typeof account.paymentMethod === 'string' && account.paymentMethod !== '-') ? (
                                            <div className="flex items-center gap-2">
                                                {account.paymentMethod.includes('VISA') ? (
                                                    <div className="w-8 h-5 flex items-center justify-center bg-[#182C9E] rounded-[3px]">
                                                        <span className="text-[9px] font-bold text-white tracking-wider">VISA</span>
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-5 flex items-center justify-center bg-[#0F172A] rounded-[3px] relative overflow-hidden">
                                                        <div className="flex -space-x-1 z-10">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-[#EB001B]" />
                                                            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F00]" />
                                                        </div>
                                                    </div>
                                                )}
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    - {account.paymentMethod.substring(account.paymentMethod.length - 4)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-4 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                                        {account.timeZone}{account.timeZoneOffset !== undefined && account.timeZoneOffset !== null
                                            ? ` | ${account.timeZoneOffset >= 0 ? '+' : ''}${account.timeZoneOffset}`
                                            : ''}
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-center text-sm text-gray-600 dark:text-gray-400">
                                        {account.nationality}
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-center">
                                        <Badge variant="outline" className="font-mono text-xs dark:border-zinc-700 dark:text-gray-300">
                                            {account.currency}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openSpendingLimitDialog(account)}>
                                                    <Edit3 className="mr-2 h-4 w-4" />
                                                    <span>{t('accounts.actions.setLimit', 'Set Spending Limit')}</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleSpendingLimitAction(account, 'reset')}>
                                                    <RotateCcw className="mr-2 h-4 w-4" />
                                                    <span>{t('accounts.actions.resetLimit', 'Reset Limit')}</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleSpendingLimitAction(account, 'delete')} className="text-red-600 focus:text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    <span>{t('accounts.actions.deleteLimit', 'Delete Limit')}</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {accounts.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={10} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50">
                                        {t('accounts.noAccounts', 'No accounts found')}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={spendingLimitDialogOpen} onOpenChange={setSpendingLimitDialogOpen}>
                <DialogContent className="sm:max-w-[420px] p-0 gap-0">
                    {/* Header */}
                    {/* Header */}
                    <div className="flex items-center gap-2 px-6 pt-6 pb-2">
                        <span className="text-blue-600 text-xl font-bold">{getCurrencySymbol(selectedAccountForLimit?.currency)}</span>
                        <DialogTitle className="text-[17px] font-semibold text-[#0E1B25] dark:text-gray-100">
                            {t('accounts.spendingLimit.title', 'Set Spending Limit')}
                        </DialogTitle>
                        <button
                            onClick={() => setSpendingLimitDialogOpen(false)}
                            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                        >
                            <span className="sr-only">Close</span>
                        </button>
                    </div>

                    {selectedAccountForLimit && (
                        <div className="px-6 pb-6 space-y-5">
                            {/* Account Info - Light blue card with border */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
                                <div className="font-bold text-base text-[#0F172A] dark:text-gray-100">{selectedAccountForLimit.name}</div>
                                <div className="text-sm text-[#64748B] dark:text-gray-400 mt-0.5">{selectedAccountForLimit.account_id}</div>
                            </div>

                            {/* Money Info */}
                            <div className="space-y-1">
                                <div className="text-[15px]">
                                    <span className="font-medium text-[#0F172A] dark:text-gray-200">{t('accounts.spendingLimit.moneyLeft', 'Money Left')}: </span>
                                    <span className="text-[#0F172A] dark:text-gray-200">
                                        {selectedAccountForLimit.spendingCap
                                            ? formatCurrencyByCode(Math.max(0, (Number(selectedAccountForLimit.spendingCap) - Number(selectedAccountForLimit.spentAmount || 0))), selectedAccountForLimit.currency || 'USD', { maximumFractionDigits: 2 })
                                            : '∞'
                                        }
                                    </span>
                                </div>
                                <div className="text-[15px]">
                                    <span className="text-[#0F172A] dark:text-gray-200">{t('accounts.spendingLimit.spent', 'Spent')} </span>
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                                        {formatCurrencyByCode(Number(selectedAccountForLimit.spentAmount || 0), selectedAccountForLimit.currency || 'USD', { maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[#0F172A] dark:text-gray-200"> • {t('accounts.table.limit', 'Limit')}: </span>
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                                        {selectedAccountForLimit.spendingCap ? formatCurrencyByCode(Number(selectedAccountForLimit.spendingCap), selectedAccountForLimit.currency || 'USD', { maximumFractionDigits: 2 }) : '∞'}
                                    </span>
                                </div>
                            </div>

                            {/* Reset notice */}
                            {spendingLimitAction === 'reset' && (
                                <p className="text-sm text-[#64748B] dark:text-gray-400">
                                    {t('accounts.spendingLimit.resetNotice', 'The spent amount will be reset to 0 after resetting')}
                                </p>
                            )}

                            {/* Action Selection - Only show if has spending cap */}
                            {selectedAccountForLimit.spendingCap && (
                                <div className="space-y-3 pt-1">
                                    <div className="text-[11px] font-bold text-[#64748B] dark:text-gray-500 uppercase tracking-wider">
                                        {t('accounts.spendingLimit.chooseAction', 'CHOOSE AN ACTION')}
                                    </div>
                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${spendingLimitAction === 'change' ? 'border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                                {spendingLimitAction === 'change' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                            </div>
                                            <input
                                                type="radio"
                                                name="action"
                                                checked={spendingLimitAction === 'change'}
                                                onChange={() => setSpendingLimitAction('change')}
                                                className="hidden"
                                            />
                                            <span className="text-[15px] text-[#0F172A] dark:text-gray-200">{t('accounts.spendingLimit.change', 'Change Limit')}</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${spendingLimitAction === 'reset' ? 'border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                                {spendingLimitAction === 'reset' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                                            </div>
                                            <input
                                                type="radio"
                                                name="action"
                                                checked={spendingLimitAction === 'reset'}
                                                onChange={() => setSpendingLimitAction('reset')}
                                                className="hidden"
                                            />
                                            <span className="text-[15px] text-[#0F172A] dark:text-gray-200">{t('accounts.spendingLimit.reset', 'Reset Limit')}</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* New Limit Input - Only show for change action */}
                            {(spendingLimitAction === 'change' || !selectedAccountForLimit.spendingCap) && (
                                <div className="space-y-2">
                                    <div className="text-[15px] text-[#64748B] dark:text-gray-400">
                                        {t('accounts.spendingLimit.newLimit', 'New Spending Limit')}
                                    </div>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={newLimitValue}
                                            onChange={(e) => setNewLimitValue(e.target.value)}
                                            className="pr-16 h-[46px] text-base rounded-full border-gray-200 dark:border-zinc-700 focus-visible:ring-blue-600 focus-visible:border-blue-600 px-4 bg-white dark:bg-zinc-900"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 font-bold text-sm">
                                            {selectedAccountForLimit.currency || 'USD'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button - Blue with icon */}
                            <Button
                                onClick={handleSaveSpendingLimit}
                                disabled={isUpdatingLimit || (spendingLimitAction === 'change' && !newLimitValue)}
                                className="w-full h-[46px] bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[15px] font-medium shadow-sm active:scale-[0.98] transition-all"
                            >
                                {isUpdatingLimit ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('accounts.spendingLimit.update', 'Updating...')}
                                    </>
                                ) : (
                                    <>
                                        <Edit3 className="h-4 w-4 mr-2" />
                                        {spendingLimitAction === 'reset' ? t('accounts.spendingLimit.reset', 'Reset Limit') : t('accounts.spendingLimit.change', 'Change Limit')}
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
