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
import { useConfig } from '@/contexts/AdAccountContext';

type SubTabKey = 'all' | 'by-business' | 'pages';

export default function AccountsContent() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { refreshData } = useConfig();

  const subTabFromUrl = searchParams.get('subtab') || 'all';
  const validSubTabs: SubTabKey[] = ['all', 'by-business', 'pages'];
  const activeSubTab = validSubTabs.includes(subTabFromUrl as SubTabKey) ? (subTabFromUrl as SubTabKey) : 'all';

  const [accountsRefreshTrigger, setAccountsRefreshTrigger] = useState(0);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasTeamMembers, setHasTeamMembers] = useState<boolean | null>(null);

  // Refresh context data when this component loads
  useEffect(() => {
    if (session?.user) {
      refreshData(false);
    }
  }, [session, refreshData]);

  const handleSubTabChange = (subTab: SubTabKey) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', 'accounts');
    params.set('subtab', subTab);
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
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden px-6 md:px-8 py-4">
      {/* Sub-tabs */}
      <div className="flex-shrink-0 mb-4">
        <nav className="flex gap-2">
          <button
            onClick={() => handleSubTabChange('all')}
            className={`${activeSubTab === 'all'
              ? 'text-foreground bg-secondary font-semibold border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border'
              } py-2 px-3 font-medium text-sm transition-all flex items-center gap-2 rounded-lg`}
          >
            <Building2 className="h-4 w-4 text-indigo-500" />
            <span>{t('ads.accounts.all', 'All Accounts')}</span>
          </button>
          <button
            onClick={() => handleSubTabChange('by-business')}
            className={`${activeSubTab === 'by-business'
              ? 'text-foreground bg-secondary font-semibold border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border'
              } py-2 px-3 font-medium text-sm transition-all flex items-center gap-2 rounded-lg`}
          >
            <Briefcase className="h-4 w-4 text-amber-500" />
            <span>{t('ads.accounts.byBusiness', 'By Business')}</span>
          </button>
          <button
            onClick={() => handleSubTabChange('pages')}
            className={`${activeSubTab === 'pages'
              ? 'text-foreground bg-secondary font-semibold border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border'
              } py-2 px-3 font-medium text-sm transition-all flex items-center gap-2 rounded-lg`}
          >
            <FileText className="h-4 w-4 text-blue-500" />
            <span>{t('ads.accounts.pages', 'Pages')}</span>
          </button>
        </nav>
      </div>

      {/* Unconnected Account Alert */}
      {!hasTeamMembers && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-full">
              <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                {t('ads.connectPrompt.title', 'Connect your Facebook Account')}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {t('ads.connectPrompt.desc', 'You need to connect a Facebook account to see your ad accounts.')}
              </p>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push('/settings?tab=team')}
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 ml-4"
          >
            {t('ads.connectPrompt.button', 'Connect Now')}
          </Button>
        </div>
      )}

      {/* Toolbar - only for All Accounts tab */}
      {activeSubTab === 'all' && (
        <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('accounts.search', 'Search accounts...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
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
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeSubTab === 'all' && (
          <AccountsTab
            refreshTrigger={accountsRefreshTrigger}
            selectedIds={selectedAccountIds}
            onSelectionChange={setSelectedAccountIds}
            searchQuery={searchQuery}
            hasTeamMembers={hasTeamMembers}
          />
        )}
        {activeSubTab === 'by-business' && (
          <div className="h-full overflow-auto">
            <AccountsByBusinessTab />
          </div>
        )}
        {activeSubTab === 'pages' && (
          <div className="h-full overflow-auto">
            <PagesByBusinessTab />
          </div>
        )}
      </div>
    </div>
  );
}
