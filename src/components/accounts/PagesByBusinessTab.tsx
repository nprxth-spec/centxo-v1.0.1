'use client';


import { useConfig } from '@/contexts/AdAccountContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function PagesByBusinessTab() {
    const { businessPages, businesses, refreshData, loading } = useConfig();

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        direction: 'asc' | 'desc' | null;
    }>({ key: 'business_name', direction: 'asc' });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            return { key: null, direction: null };
        });
    };

    const sortedData = [...businessPages].sort((a: any, b: any) => {
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
                    {businessPages.length} Pages across all Business Portfolios
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshData(true)}
                    className="h-8 bg-white dark:bg-zinc-900"
                    disabled={loading}
                >
                    <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="overflow-auto flex-1 [&>div]:overflow-visible">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
                        <p className="text-sm text-muted-foreground">Loading pages...</p>
                    </div>
                ) : businessPages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-foreground">No Pages Found</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            We couldn't find any Facebook Pages associated with your business portfolios.
                        </p>
                    </div>
                ) : (
                    <Table className="min-w-max">
                        <TableHeader className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-50 shadow-sm">
                            <TableRow>
                                <SortableHeader columnKey="business_name" label="Business Account" align="left" className="min-w-[200px]" />
                                <SortableHeader columnKey="name" label="Page Name" align="left" className="min-w-[240px]" />
                                <SortableHeader columnKey="is_published" label="Status" align="center" className="w-[120px]" />
                                <TableHead className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 max-w-[120px]">
                                    Access
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {sortedData.map((page: any) => {
                                // Find matching business for profile picture (if business_name is available)
                                const businessName = page.business_name;
                                const matchingBusiness = businesses.find(b => b.name === businessName);
                                const businessPic = matchingBusiness?.profile_picture_uri;

                                const hasAccess = !!page.access_token;
                                const status = page.is_published === true ? 'Published' :
                                    page.is_published === false ? 'Unpublished' : 'N/A';
                                const statusColor = status === 'Published' ? 'bg-green-500' :
                                    status === 'Unpublished' ? 'bg-yellow-500' : 'bg-gray-500';

                                return (
                                    <TableRow key={page.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
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
                                                    {matchingBusiness && (
                                                        <div className="text-xs text-muted-foreground font-mono mt-0.5">ID: {matchingBusiness.id}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-4 py-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200 dark:border-zinc-700">
                                                    {page.picture?.data?.url ? (
                                                        <img src={page.picture.data.url} alt={page.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileText className="h-5 w-5 text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]" title={page.name}>
                                                        {page.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono mt-0.5">ID: {page.id}</div>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-4 py-2">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
                                                <span className="text-sm text-muted-foreground">{status}</span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-4 py-2 text-center">
                                            <Badge variant={hasAccess ? 'default' : 'outline'} className={cn("text-xs font-medium", !hasAccess && "text-muted-foreground")}>
                                                {hasAccess ? 'Access' : 'Restricted'}
                                            </Badge>
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

