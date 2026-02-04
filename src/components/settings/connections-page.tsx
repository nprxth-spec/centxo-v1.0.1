'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Users } from 'lucide-react';
import { ConnectionsSettings } from './connections-settings';
import { AdAccountsSettings } from './ad-accounts-settings';
import { TeamSettings } from './team-settings';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, createContext, useContext } from 'react';

const TeamIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="7" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <circle cx="19" cy="11" r="3" />
        <path d="M22 21v-1a4 4 0 0 0-3-2.87" />
        <circle cx="5" cy="11" r="3" />
        <path d="M2 21v-1a4 4 0 0 1 3-2.87" />
    </svg>
)

// Create context to signal when Facebook account is added
export const FacebookAccountAddedContext = createContext<{
    accountAdded: boolean;
    setAccountAdded: (value: boolean) => void;
}>({
    accountAdded: false,
    setAccountAdded: () => {}
});

export function ConnectionsPage() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Sync tab from URL - use searchParams directly to avoid hydration mismatch
    const tabFromUrl = searchParams.get('tab') || 'connections';
    const [activeTab, setActiveTab] = useState(tabFromUrl);
    const [accountAdded, setAccountAdded] = useState(false);

    // Update URL when tab changes
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // Sync state when URL changes (e.g. direct navigation, browser back)
    useEffect(() => {
        if (tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl, activeTab]);

    return (
        <FacebookAccountAddedContext.Provider value={{ accountAdded, setAccountAdded }}>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
                {/* Tabs Header Box - Attached to Header */}
                <div className="border-b border-r border-border bg-card shadow-sm overflow-x-auto">
                    <TabsList className="flex w-full justify-start bg-transparent p-0 h-auto gap-4 md:gap-6 pt-3 pb-0 transition-all duration-200 pl-4 md:pl-[3.5rem] lg:pl-[4.5rem] min-w-max md:min-w-0">
                        <TabsTrigger
                            value="connections"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-0 pt-2.5 pb-3.5 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none flex items-center"
                        >
                            <Link2 className="mr-2 h-4 w-4" />
                            {t('settings.connections', 'Connections')}
                        </TabsTrigger>
                        <TabsTrigger
                            value="ad-accounts"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-0 pt-2.5 pb-3.5 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none flex items-center"
                        >
                            <Users className="mr-2 h-4 w-4" />
                            {t('settings.adAccounts', 'Ad Accounts')}
                        </TabsTrigger>
                        <TabsTrigger
                            value="team"
                            className="rounded-none border-b-2 border-transparent bg-transparent px-0 pt-2.5 pb-3.5 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none flex items-center"
                        >
                            <TeamIcon className="mr-2 h-4 w-4" />
                            {t('settings.team', 'Team')}
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Content Box - Centered (same as settings/account) */}
                <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
                    <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                        <div className="h-full overflow-y-auto px-6 md:px-8 lg:px-10 py-6 md:py-8">
                            <TabsContent value="connections" className="space-y-6 mt-0">
                                <div className="space-y-0.5">
                                    <h2 className="text-2xl font-bold tracking-tight">{t('settings.connections', 'Connections')}</h2>
                                    <p className="text-muted-foreground">
                                        {t('settings.connectionsDesc', 'Manage your connected accounts and integrations.')}
                                    </p>
                                </div>
                                <div className="my-6 h-[1px] bg-border" />
                                <ConnectionsSettings onAccountAdded={() => setAccountAdded(true)} />
                            </TabsContent>

                            <TabsContent value="ad-accounts" className="space-y-6 mt-0">
                                <div className="space-y-0.5">
                                    <h2 className="text-2xl font-bold tracking-tight">{t('settings.adAccounts', 'Ad Accounts')}</h2>
                                    <p className="text-muted-foreground">
                                        {t('settings.adAccountsDesc', 'Manage your advertising accounts and permissions.')}
                                    </p>
                                </div>
                                <div className="my-6 h-[1px] bg-border" />
                                <AdAccountsSettings />
                            </TabsContent>

                            <TabsContent value="team" className="space-y-6 mt-0">
                                <div className="space-y-0.5">
                                    <h2 className="text-2xl font-bold tracking-tight">{t('settings.team', 'Team')}</h2>
                                    <p className="text-muted-foreground">
                                        {t('settings.teamDesc', 'Manage team members and their permissions.')}
                                    </p>
                                </div>
                                <div className="my-6 h-[1px] bg-border" />
                                <TeamSettings />
                            </TabsContent>
                        </div>
                    </div>
                </div>
            </Tabs>
        </FacebookAccountAddedContext.Provider>
    );
}
