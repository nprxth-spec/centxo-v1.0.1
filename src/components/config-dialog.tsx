'use client';

import { useState } from 'react';
import { useConfig } from '@/contexts/AdAccountContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Building2, FileText, Loader2, RefreshCw, Search, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ConfigDialog() {
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
        refreshData
    } = useConfig();

    const [open, setOpen] = useState(false);
    const [accountSearch, setAccountSearch] = useState('');
    const [pageSearch, setPageSearch] = useState('');

    if (loading) {
        return (
            <Button variant="ghost" className="h-9 px-3 text-white hover:bg-white/20 border border-white/20" disabled>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading...</span>
            </Button>
        );
    }

    const totalSelected = selectedAccounts.length + selectedPages.length;

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

    const handleSave = () => {
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="h-9 px-3 text-white hover:bg-white/20 border border-white/20">
                    <Settings className="h-4 w-4 mr-2" />
                    <span className="text-sm">
                        {totalSelected === 0 ? 'Config' : `${totalSelected} Selected`}
                    </span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Configuration</DialogTitle>
                    <DialogDescription>
                        Select Ad Accounts and Pages to use throughout the application
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="accounts" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="accounts" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Ad Accounts ({selectedAccounts.length})
                        </TabsTrigger>
                        <TabsTrigger value="pages" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Pages ({selectedPages.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="accounts" className="mt-4">
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

                            {/* Table Header */}
                            <div className="grid grid-cols-[auto,1fr,200px] gap-3 py-2 px-2 border-b bg-muted/50 font-medium text-sm">
                                <Checkbox
                                    checked={allAccountsSelected}
                                    onCheckedChange={toggleAllAccounts}
                                    className="rounded-sm mt-0.5"
                                />
                                <span>Name</span>
                                <span>ID</span>
                            </div>

                            <ScrollArea className="h-[300px] pr-4">
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
                                            return (
                                                <div
                                                    key={account.id}
                                                    onClick={() => toggleAccount(account)}
                                                    className="grid grid-cols-[auto,1fr,200px] gap-3 py-3 px-2 hover:bg-accent cursor-pointer transition-colors items-center"
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleAccount(account)}
                                                        className="rounded-sm"
                                                    />
                                                    <span className="font-medium text-sm truncate">{account.name}</span>
                                                    <span className="text-sm text-muted-foreground truncate">{account.account_id}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </TabsContent>

                    <TabsContent value="pages" className="mt-4">
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

                            {/* Table Header */}
                            <div className="grid grid-cols-[auto,1fr,200px] gap-3 py-2 px-2 border-b bg-muted/50 font-medium text-sm">
                                <Checkbox
                                    checked={allPagesSelected}
                                    onCheckedChange={toggleAllPages}
                                    className="rounded-sm mt-0.5"
                                />
                                <span>Name</span>
                                <span>ID</span>
                            </div>

                            <ScrollArea className="h-[300px] pr-4">
                                {filteredPages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-center">
                                        <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">
                                            {pageSearch ? 'No matching pages found' : 'No pages found'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {filteredPages.map((page) => {
                                            const isSelected = selectedPages.some(p => p.id === page.id);
                                            return (
                                                <div
                                                    key={page.id}
                                                    onClick={() => togglePage(page)}
                                                    className="grid grid-cols-[auto,1fr,200px] gap-3 py-3 px-2 hover:bg-accent cursor-pointer transition-colors items-center"
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => togglePage(page)}
                                                        className="rounded-sm"
                                                    />
                                                    <span className="font-medium text-sm truncate">{page.name}</span>
                                                    <span className="text-sm text-muted-foreground truncate">{page.id}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-between items-center gap-2 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                        Total: {totalSelected} selected
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>
                            <Check className="h-4 w-4 mr-2" />
                            Save
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
