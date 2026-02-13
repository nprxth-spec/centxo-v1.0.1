'use client';

import { useConfig } from '@/contexts/AdAccountContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Loader2, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function AccountsByBusinessTab() {
    const { businessAccounts, businesses, refreshData, loading } = useConfig();

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        direction: 'asc' | 'desc' | null;
    }>({ key: 'business_name', direction: 'asc' });

    // Helper to determine status (matches Pages style: dot + text, centered)
    const getAccountStatus = (account: any) => {
        const status = typeof account.account_status === 'string' ? parseInt(account.account_status) : account.account_status;
        if (status === 1) return { statusText: 'Active', statusColor: 'bg-green-500' };
        if (status === 2) return { statusText: 'Disabled', statusColor: 'bg-red-500' };
        if (status === 3) return { statusText: 'Unsettled', statusColor: 'bg-orange-500' };
        return { statusText: 'Unknown', statusColor: 'bg-yellow-500' };
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            return { key: null, direction: null };
        });
    };

    const sortedData = [...(businessAccounts || [])].sort((a: any, b: any) => {
        if (!sortConfig.key || !sortConfig.direction) return 0;

        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const SortableHeader = ({ columnKey, label, align = 'left', className }: { columnKey: string, label: string, align?: 'left' | 'center' | 'right', className?: string }) => (
        <TableHead className={cn(
            "px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors select-none group",
            align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
            className
        )} onClick={() => handleSort(columnKey)}>
            <div className={cn("flex items-center gap-1.5", align === 'center' && "justify-center", align === 'right' && "justify-end")}>
                {label}
                <div className="flex flex-col">
                    {sortConfig.key === columnKey ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                    ) : (
                        <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            </div>
        </TableHead>
    );

    return (
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 overflow-hidden flex-1 flex flex-col min-h-0 rounded-lg h-full">
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50">
                <p className="text-sm text-muted-foreground font-medium">
                    {(businessAccounts || []).length} Ad Accounts in your Business Portfolios
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshData(true)}
                    className="h-8 bg-white dark:bg-zinc-900"
                    disabled={loading}
                >
                    <RefreshCw className={cn("h-3 w-3 mr-2", loading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <div className="overflow-auto flex-1 [&>div]:overflow-visible">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
                        <p className="text-sm text-muted-foreground">Loading accounts...</p>
                    </div>
                ) : !businessAccounts?.length ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <Briefcase className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-foreground">No Business Accounts Found</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            All ad accounts in your Business Portfolios will appear here.
                        </p>
                    </div>
                ) : (
                    <Table className="min-w-max">
                        <TableHeader className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-50 shadow-sm">
                            <TableRow>
                                <SortableHeader columnKey="business_name" label="Business Account" align="left" className="min-w-[200px]" />
                                <SortableHeader columnKey="name" label="Account Name" align="left" className="min-w-[240px]" />
                                <SortableHeader columnKey="account_status" label="Status" align="center" className="w-[120px]" />
                                <TableHead className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 max-w-[120px]">
                                    Access
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {sortedData.map((account: any) => {
                                const { statusText, statusColor } = getAccountStatus(account);
                                const businessName = account.business_name;
                                const matchingBusiness = businesses?.find((b: any) => b.name === businessName);
                                const businessPic = matchingBusiness?.profile_picture_uri || account.business_profile_picture_uri;
                                const businessId = account.business_id || matchingBusiness?.id;

                                return (
                                    <TableRow key={account.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <TableCell className="px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                {businessPic ? (
                                                    <img
                                                        src={businessPic}
                                                        alt={businessName || ''}
                                                        className="w-8 h-8 rounded-full border border-gray-100 flex-shrink-0 object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                        {(businessName || 'U').substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]" title={businessName}>
                                                        {businessName || 'Personal/Shared'}
                                                    </div>
                                                    {businessId && (
                                                        <div className="text-xs text-muted-foreground font-mono mt-0.5">ID: {businessId}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-4 py-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200 dark:border-zinc-700">
                                                    <Briefcase className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 group">
                                                        <Link
                                                            href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${account.account_id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[200px] block"
                                                            title={account.name}
                                                        >
                                                            {account.name}
                                                        </Link>
                                                        <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono mt-0.5">ID: {account.account_id}</div>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-4 py-2">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColor)} />
                                                <span className="text-sm text-muted-foreground">{statusText}</span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-4 py-2 text-center">
                                            {account.hasDirectAccess === true ? (
                                                <Badge variant="default" className="text-xs font-medium">
                                                    Access
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-xs font-medium">
                                                    Restricted
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
