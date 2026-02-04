'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionManagement } from './session-management';
import { ProfileSettings } from './profile-settings';
import { DeleteAccountSettings } from './delete-account-settings';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AccountSettings() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Get default tab from URL or fallback to "account"
    const defaultTab = searchParams.get('tab') || 'account';
    const [activeTab, setActiveTab] = useState(defaultTab);

    // Update URL when tab changes
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // Sync state if URL changes externally (e.g. back button)
    useEffect(() => {
        const tabFromUrl = searchParams.get('tab');
        if (tabFromUrl && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [searchParams]);

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
            {/* Tabs Header Box - Attached to Header */}
            <div className="border-b border-r border-border bg-card shadow-sm overflow-x-auto">
                <TabsList className="flex w-full justify-start bg-transparent p-0 h-auto gap-4 md:gap-6 pt-4 pb-3 transition-all duration-200 pl-4 md:pl-[3.5rem] lg:pl-[4.5rem] min-w-max md:min-w-0">
                    <TabsTrigger
                        value="account"
                        className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                        {t('settings.accountSettings', 'Account Settings')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="sessions"
                        className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                        {t('settings.sessions', 'Session Management')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="delete"
                        className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                        {t('settings.deleteAccount', 'Delete Account')}
                    </TabsTrigger>
                </TabsList>
            </div>

            {/* Content Box - Centered */}
            <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
                <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                    <div className="h-full overflow-y-auto px-6 md:px-8 lg:px-10 py-6 md:py-8">
                        <TabsContent value="account" className="space-y-6 mt-0">
                            <ProfileSettings />
                        </TabsContent>

                        <TabsContent value="sessions" className="space-y-6 mt-0">
                            <div className="space-y-0.5">
                                <h2 className="text-2xl font-bold tracking-tight">{t('settings.sessions', 'Session Management')}</h2>
                                <p className="text-muted-foreground">
                                    {t('settings.sessionsDesc', 'Manage your active sessions and devices.')}
                                </p>
                            </div>
                            <div className="my-6 h-[1px] bg-border" />
                            <SessionManagement />
                        </TabsContent>

                        <TabsContent value="delete" className="space-y-6 mt-0">
                            <div className="space-y-0.5">
                                <h2 className="text-2xl font-bold tracking-tight">{t('settings.deleteAccount', 'Delete Account')}</h2>
                                <p className="text-muted-foreground">
                                    {t('settings.deleteAccountDesc', 'Permanently delete your account and all associated data.')}
                                </p>
                            </div>
                            <div className="my-6 h-[1px] bg-border" />
                            <DeleteAccountSettings />
                        </TabsContent>
                    </div>
                </div>
            </div>
        </Tabs>
    );
}
