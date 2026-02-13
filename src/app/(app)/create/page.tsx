'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, Sparkles, Loader2 } from "lucide-react";
import dynamic from 'next/dynamic';

// Dynamically import the heavy components
const QuickLaunchContent = dynamic(
  () => import('./QuickLaunchContent'),
  { 
    loading: () => <TabLoadingState />,
    ssr: false 
  }
);

const AutoCreateContent = dynamic(
  () => import('./AutoCreateContent'),
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

type TabKey = 'quick' | 'auto';

export default function UnifiedCreatePage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get tab from URL or default to 'quick'
  const tabFromUrl = searchParams.get('tab') || 'quick';
  const validTabs: TabKey[] = ['quick', 'auto'];
  const [activeTab, setActiveTab] = useState<TabKey>(
    validTabs.includes(tabFromUrl as TabKey) ? (tabFromUrl as TabKey) : 'quick'
  );

  // Sync URL when tab changes
  const handleTabChange = (tab: string) => {
    const newTab = tab as TabKey;
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', newTab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Sync state when URL changes externally
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && validTabs.includes(tabParam as TabKey) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabKey);
    }
  }, [searchParams]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-6 md:px-8 pt-4 border-b bg-background">
          <TabsList className="bg-transparent p-0 h-auto gap-4">
            <TabsTrigger
              value="quick"
              className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-1 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Rocket className="mr-2 h-4 w-4" />
              {t('create.tabs.quick', 'Quick Launch')}
            </TabsTrigger>
            <TabsTrigger
              value="auto"
              className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-1 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t('create.tabs.auto', 'Auto Create')}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          <TabsContent value="quick" className="h-full m-0 data-[state=inactive]:hidden">
            <Suspense fallback={<TabLoadingState />}>
              <QuickLaunchContent />
            </Suspense>
          </TabsContent>

          <TabsContent value="auto" className="h-full m-0 data-[state=inactive]:hidden">
            <Suspense fallback={<TabLoadingState />}>
              <AutoCreateContent />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
