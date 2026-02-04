'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useConfig } from '@/contexts/AdAccountContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Building2, FileText, Loader2, RefreshCw, Search, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export function ConfigForm() {
    const {
        selectedAccounts,
        setSelectedAccounts,
        toggleAccount,
        adAccounts,
        selectedPages,
        setSelectedPages,
        togglePage,
        pages,
        loading,
        error,
        refreshData
    } = useConfig();

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Get active tab from URL or default to 'accounts'
    const validViews = ['accounts', 'pages'];
    const viewFromUrl = searchParams.get('view') || 'accounts';
    const activeTab = validViews.includes(viewFromUrl) ? viewFromUrl : 'accounts';

    // Redirect old URLs: business-accounts, business-pages, businesses moved
    useEffect(() => {
        if (viewFromUrl === 'business-accounts' || viewFromUrl === 'business-pages') {
            router.replace(viewFromUrl === 'business-accounts'
                ? '/ads-manager/accounts-vcid?tab=accounts-by-business'
                : '/ads-manager/accounts-vcid?tab=pages-by-business');
        } else if (viewFromUrl === 'businesses') {
            const params = new URLSearchParams(searchParams.toString());
            params.set('view', 'accounts');
            router.replace(`${pathname}?${params.toString()}`);
        }
    }, [viewFromUrl, router, pathname, searchParams]);

    if (viewFromUrl === 'business-accounts' || viewFromUrl === 'business-pages' || viewFromUrl === 'businesses') {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const onTabChange = (val: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('view', val);
        router.push(`${pathname}?${params.toString()}`);
    };

    const [accountSearch, setAccountSearch] = useState('');
    const [pageSearch, setPageSearch] = useState('');

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-destructive/5 text-destructive">
                <p className="mb-4 text-center font-medium">Failed to load configuration</p>
                <p className="text-sm text-center mb-4 text-muted-foreground">{error}</p>
                <Button onClick={() => refreshData(true)} variant="outline" className="border-destructive/20 hover:bg-destructive/10">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                </Button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 border rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm">Loading configuration data...</span>
            </div>
        );
    }

    // Filter accounts based on search
    const filteredAccounts = adAccounts.filter(account =>
        account.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
        account.account_id.toLowerCase().includes(accountSearch.toLowerCase())
    );

    // Filter pages based on search
    const filteredPages = pages.filter(page =>
        page.name.toLowerCase().includes(pageSearch.toLowerCase()) ||
        page.id.toLowerCase().includes(pageSearch.toLowerCase())
    );

    // Select/Deselect all accounts
    const toggleAllAccounts = () => {
        if (selectedAccounts.length === filteredAccounts.length) {
            const remainingAccounts = selectedAccounts.filter(
                acc => !filteredAccounts.some(fa => fa.id === acc.id)
            );
            setSelectedAccounts(remainingAccounts);
        } else {
            const newAccounts = [...selectedAccounts];
            filteredAccounts.forEach(account => {
                if (!newAccounts.some(acc => acc.id === account.id)) {
                    newAccounts.push(account);
                }
            });
            setSelectedAccounts(newAccounts);
        }
    };

    // Select/Deselect all pages
    const toggleAllPages = () => {
        if (selectedPages.length === filteredPages.length) {
            const remainingPages = selectedPages.filter(
                p => !filteredPages.some(fp => fp.id === p.id)
            );
            setSelectedPages(remainingPages);
        } else {
            const newPages = [...selectedPages];
            filteredPages.forEach(page => {
                if (!newPages.some(p => p.id === page.id)) {
                    newPages.push(page);
                }
            });
            setSelectedPages(newPages);
        }
    };

    const allAccountsSelected = filteredAccounts.length > 0 &&
        filteredAccounts.every(account => selectedAccounts.some(acc => acc.id === account.id));

    const allPagesSelected = filteredPages.length > 0 &&
        filteredPages.every(page => selectedPages.some(p => p.id === page.id));

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                <div className="space-y-2">
                    <TabsList className="w-full h-auto flex flex-wrap lg:grid lg:grid-cols-2">
                        <TabsTrigger value="accounts" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Ad Accounts ({adAccounts.length})
                        </TabsTrigger>
                        <TabsTrigger value="pages" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Pages ({pages.length})
                        </TabsTrigger>
                    </TabsList>
                    <p className="text-xs text-muted-foreground">
                        <Link href="/ads-manager/accounts-vcid" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                            <ExternalLink className="h-3 w-3" />
                            Accounts by Business & Pages by Business
                        </Link>
                    </p>
                </div>

                <TabsContent value="accounts" className="mt-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {selectedAccounts.length} of {adAccounts.length} selected
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refreshData(true)}
                                className="h-8"
                            >
                                <RefreshCw className="h-3 w-3 mr-2" />
                                Refresh
                            </Button>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search ad accounts..."
                                value={accountSearch}
                                onChange={(e) => setAccountSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Table Container with Horizontal Scroll */}
                        <div className="border rounded-md overflow-hidden">
                            <div className="overflow-x-auto">
                                <div className="min-w-[850px]">
                                    <ScrollArea className="h-[400px]">
                                        {/* Table Header - Sticky */}
                                        <div className="grid grid-cols-[40px_minmax(200px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_120px] gap-4 py-2 px-2 border-b bg-muted font-medium text-sm sticky top-0 z-10">
                                            <Checkbox
                                                checked={allAccountsSelected}
                                                onCheckedChange={toggleAllAccounts}
                                                className="mt-0.5"
                                            />
                                            <span>Name</span>
                                            <span>ID</span>
                                            <span>Owner</span>
                                            <span>Status</span>
                                        </div>
                                        {filteredAccounts.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-40 text-center">
                                                <Building2 className="h-12 w-12 text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground">
                                                    {accountSearch ? 'No matching ad accounts found' : 'No ad accounts found'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="divide-y">
                                                {filteredAccounts.map((account) => {
                                                    const isSelected = selectedAccounts.some(acc => acc.id === account.id);

                                                    // Determine status
                                                    const getStatusInfo = (status?: number) => {
                                                        switch (status) {
                                                            case 1:
                                                                return { label: 'Active', color: 'bg-green-500' };
                                                            case 2:
                                                                return { label: 'Disabled', color: 'bg-red-500' };
                                                            case 3:
                                                                return { label: 'Unsettled', color: 'bg-red-500' };
                                                            case 7:
                                                                return { label: 'Pending Risk Review', color: 'bg-yellow-500' };
                                                            case 100:
                                                                return { label: 'Pending Closure', color: 'bg-orange-500' };
                                                            case 101:
                                                                return { label: 'Closed', color: 'bg-gray-400' };
                                                            default:
                                                                return { label: 'Unknown', color: 'bg-gray-300' };
                                                        }
                                                    };

                                                    const statusInfo = getStatusInfo(account.account_status);

                                                    return (
                                                        <div
                                                            key={account.id}
                                                            onClick={() => toggleAccount(account)}
                                                            className="grid grid-cols-[40px_minmax(200px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_120px] gap-4 py-3 px-2 hover:bg-accent cursor-pointer transition-colors items-center"
                                                        >
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleAccount(account)}
                                                            />
                                                            <span className="font-medium text-sm truncate" title={account.name}>{account.name}</span>
                                                            <span className="text-sm text-muted-foreground truncate">{account.account_id}</span>
                                                            <span className="text-sm text-muted-foreground truncate">{(account as any)._source?.facebookName || 'Unknown'}</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full ${statusInfo.color || 'bg-gray-400'
                                                                    }`} />
                                                                <span className="text-sm text-foreground">
                                                                    {statusInfo.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="pages" className="mt-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {selectedPages.length} of {pages.length} selected
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refreshData(true)}
                                className="h-8"
                            >
                                <RefreshCw className="h-3 w-3 mr-2" />
                                Refresh
                            </Button>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search pages..."
                                value={pageSearch}
                                onChange={(e) => setPageSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Table Container with Horizontal Scroll */}
                        <div className="border rounded-md overflow-hidden">
                            <div className="overflow-x-auto">
                                <div className="min-w-[850px]">
                                    <ScrollArea className="h-[400px]">
                                        {/* Table Header - Sticky (same grid as accounts) */}
                                        <div className="grid grid-cols-[40px_minmax(200px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_120px] gap-4 py-2 px-2 border-b bg-muted font-medium text-sm sticky top-0 z-10">
                                            <Checkbox
                                                checked={allPagesSelected}
                                                onCheckedChange={toggleAllPages}
                                                className="mt-0.5"
                                            />
                                            <span>Name</span>
                                            <span>ID</span>
                                            <span>Owner</span>
                                            <span>Status</span>
                                        </div>
                                        {filteredPages.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-40 text-center">
                                                <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                                                <p className="text-sm text-muted-foreground">
                                                    {pageSearch ? 'No matching pages found' : 'No pages found'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="divide-y">
                                                {filteredPages.map((page: any) => {
                                                    const isSelected = selectedPages.some(p => p.id === page.id);
                                                    const status = page.status || 'ACTIVE';

                                                    // Determine badge styling based on status
                                                    const getStatusBadge = () => {
                                                        if (status === 'ACTIVE') {
                                                            return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
                                                        } else if (status === 'RESTRICTED') {
                                                            return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Restricted</Badge>;
                                                        } else if (status === 'UNPUBLISHED') {
                                                            return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Unpublished</Badge>;
                                                        }
                                                        return <Badge variant="secondary">{status}</Badge>;
                                                    };

                                                    return (
                                                        <div
                                                            key={page.id}
                                                            onClick={() => togglePage(page)}
                                                            className="grid grid-cols-[40px_minmax(200px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_120px] gap-4 py-3 px-2 hover:bg-accent cursor-pointer transition-colors items-center"
                                                        >
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => togglePage(page)}
                                                            />
                                                            <span className="font-medium text-sm truncate">{page.name}</span>
                                                            <span className="text-sm text-muted-foreground truncate">{page.id}</span>
                                                            <span className="text-sm text-muted-foreground truncate">{(page as any)._source?.facebookName || 'Unknown'}</span>
                                                            <div onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${status === 'ACTIVE' ? 'bg-green-500' :
                                                                        status === 'RESTRICTED' ? 'bg-red-500' :
                                                                            status === 'UNPUBLISHED' ? 'bg-gray-400' : 'bg-gray-400'
                                                                        }`} />
                                                                    <span className="text-sm text-foreground">
                                                                        {status === 'ACTIVE' ? 'Active' :
                                                                            status === 'RESTRICTED' ? 'Restricted' :
                                                                                status === 'UNPUBLISHED' ? 'Unpublished' : status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

            </Tabs>
        </div>
    );
}
