'use client';

import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AccountsTab } from "@/components/campaigns/AccountsTab";
import { AccountsByBusinessTab } from "@/components/accounts/AccountsByBusinessTab";
import { PagesByBusinessTab } from "@/components/accounts/PagesByBusinessTab";
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Search, RefreshCw, Download, Building2, Briefcase, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoFacebookAccountsPrompt } from '@/components/NoFacebookAccountsPrompt';

type TabKey = 'accounts' | 'accounts-by-business' | 'pages-by-business';

export default function AdsManagerAccountsVcidPage() {
    const { data: session } = useSession();
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const tabFromUrl = searchParams.get('tab') || 'accounts';
    const validTabs: TabKey[] = ['accounts', 'accounts-by-business', 'pages-by-business'];
    const activeTab = validTabs.includes(tabFromUrl as TabKey) ? (tabFromUrl as TabKey) : 'accounts';

    const [accountsRefreshTrigger, setAccountsRefreshTrigger] = useState(0);
    const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasTeamMembers, setHasTeamMembers] = useState<boolean | null>(null);

    const handleTabChange = (tab: TabKey) => {
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    useEffect(() => {
        const checkTeamMembers = async () => {
            try {
                const response = await fetch('/api/team/has-members');
                if (response.ok) {
                    const data = await response.json();
                    setHasTeamMembers(data.hasMembers === true);
                } else {
                    setHasTeamMembers(false);
                }
            } catch (error) {
                console.error('Error checking team members:', error);
                setHasTeamMembers(false);
            }
        };

        if (session?.user) {
            checkTeamMembers();
        }
    }, [session]);

    const handleRefresh = () => {
        setLoading(true);
        setAccountsRefreshTrigger(prev => prev + 1);
        setTimeout(() => setLoading(false), 1000);
    };

    if (hasTeamMembers === null) {
        return (
            <div className="h-full p-4 md:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!hasTeamMembers) {
        return (
            <div className="h-full p-4 md:p-6 lg:p-8">
                <NoFacebookAccountsPrompt />
            </div>
        );
    }

    return (
        <div className="h-full p-4 md:p-6 lg:p-8 flex flex-col overflow-hidden">
            <div className="w-full flex flex-col h-full">
                {/* Tabs - at top */}
                <div className="flex-shrink-0 mb-4">
                    <nav className="flex gap-2">
                        <button
                            onClick={() => handleTabChange('accounts')}
                            className={`${activeTab === 'accounts'
                                ? 'text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900 font-semibold border border-gray-200 dark:border-zinc-800'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800'
                                } py-3 px-4 font-medium text-sm transition-all flex items-center gap-2 rounded-xl`}
                        >
                            <Building2 className="h-4 w-4 text-indigo-500" />
                            <span>Accounts</span>
                        </button>
                        <button
                            onClick={() => handleTabChange('accounts-by-business')}
                            className={`${activeTab === 'accounts-by-business'
                                ? 'text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900 font-semibold border border-gray-200 dark:border-zinc-800'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800'
                                } py-3 px-4 font-medium text-sm transition-all flex items-center gap-2 rounded-xl`}
                        >
                            <Briefcase className="h-4 w-4 text-amber-500" />
                            <span>Accounts by Business</span>
                        </button>
                        <button
                            onClick={() => handleTabChange('pages-by-business')}
                            className={`${activeTab === 'pages-by-business'
                                ? 'text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900 font-semibold border border-gray-200 dark:border-zinc-800'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800'
                                } py-3 px-4 font-medium text-sm transition-all flex items-center gap-2 rounded-xl`}
                        >
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span>Pages by Business</span>
                        </button>
                    </nav>
                </div>

                {/* Header */}
                <div className="mb-4 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('adsManager.accounts', 'Ad Accounts')}</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{t('adsManager.accountsSubtitle', 'Manage your connected ad accounts')}</p>
                    </div>
                </div>

                {/* Toolbar - only for Accounts tab */}
                {activeTab === 'accounts' && (
                    <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('accounts.search', 'Search accounts...')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                        </div>
                        <Button
                            onClick={handleRefresh}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            {t('campaigns.refresh', 'Refresh')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => console.log('Export data')}
                        >
                            <Download className="h-4 w-4" />
                            {t('campaigns.export', 'Export')}
                        </Button>
                    </div>
                )}

                {/* Tab Content */}
                {activeTab === 'accounts' && (
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <AccountsTab
                            refreshTrigger={accountsRefreshTrigger}
                            selectedIds={selectedAccountIds}
                            onSelectionChange={setSelectedAccountIds}
                            searchQuery={searchQuery}
                        />
                    </div>
                )}
                {activeTab === 'accounts-by-business' && (
                    <div className="flex-1 overflow-auto">
                        <AccountsByBusinessTab />
                    </div>
                )}
                {activeTab === 'pages-by-business' && (
                    <div className="flex-1 overflow-auto">
                        <PagesByBusinessTab />
                    </div>
                )}
            </div>
        </div>
    );
}
