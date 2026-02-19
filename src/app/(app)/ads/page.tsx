'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Megaphone, FileSpreadsheet, Loader2 } from "lucide-react";
import dynamic from 'next/dynamic';

// Dynamically import the heavy components to improve initial load
const AccountsContent = dynamic(
  () => import('./AccountsContent'),
  { 
    loading: () => <TabLoadingState />,
    ssr: false 
  }
);

const CampaignsContent = dynamic(
  () => import('./CampaignsContent'),
  { 
    loading: () => <TabLoadingState />,
    ssr: false 
  }
);

const ExportContent = dynamic(
  () => import('./ExportContent'),
  { 
    loading: () => <TabLoadingState />,
    ssr: false 
  }
);

function TabLoadingState() {
  return (
    <div className="flex items-center justify-center h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

type TabKey = 'accounts' | 'campaigns' | 'export';

// Valid tabs constant - moved outside component to avoid recreation on each render
const VALID_TABS: TabKey[] = ['accounts', 'campaigns', 'export'];

export default function UnifiedAdsPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get tab from URL or default to 'campaigns'
  const tabFromUrl = searchParams.get('tab') || 'campaigns';
  const [activeTab, setActiveTab] = useState<TabKey>(
    VALID_TABS.includes(tabFromUrl as TabKey) ? (tabFromUrl as TabKey) : 'campaigns'
  );

  // Sync URL when tab changes
  const handleTabChange = (tab: string) => {
    const newTab = tab as TabKey;
    if (!VALID_TABS.includes(newTab)) return; // Validate tab
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', newTab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Sync state when URL changes externally
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam as TabKey) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabKey);
    }
  }, [searchParams, activeTab]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-6 md:px-8 pt-4 border-b bg-background">
          <TabsList className="bg-transparent p-0 h-auto gap-4">
            <TabsTrigger
              value="campaigns"
              className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-1 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Megaphone className="mr-2 h-4 w-4" />
              {t('ads.tabs.campaigns', 'Campaigns')}
            </TabsTrigger>
            <TabsTrigger
              value="accounts"
              className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-1 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Building2 className="mr-2 h-4 w-4" />
              {t('ads.tabs.accounts', 'Accounts')}
            </TabsTrigger>
            <TabsTrigger
              value="export"
              className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-1 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {t('ads.tabs.export', 'Export')}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="campaigns" className="h-full m-0 data-[state=inactive]:hidden">
            <Suspense fallback={<TabLoadingState />}>
              <CampaignsContent />
            </Suspense>
          </TabsContent>

          <TabsContent value="accounts" className="h-full m-0 data-[state=inactive]:hidden">
            <Suspense fallback={<TabLoadingState />}>
              <AccountsContent />
            </Suspense>
          </TabsContent>

          <TabsContent value="export" className="h-full m-0 data-[state=inactive]:hidden">
            <Suspense fallback={<TabLoadingState />}>
              <ExportContent />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
