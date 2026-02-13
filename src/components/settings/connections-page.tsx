'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { TeamSettings } from './team-settings';

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

export function ConnectionsPage() {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col h-full">
            {/* Content Box - Centered (same as settings/account) */}
            <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
                <div className="border border-border rounded-lg bg-card shadow-sm overflow-hidden">
                    <div className="h-full overflow-y-auto px-6 md:px-8 lg:px-10 py-6 md:py-8">
                        <div className="space-y-6 mt-0">
                            <div className="space-y-0.5">
                                <h2 className="text-section-title">{t('settings.team', 'Team')}</h2>
                                <p className="text-muted-foreground">
                                    {t('settings.teamDesc', 'Manage team members and their permissions.')}
                                </p>
                            </div>
                            <div className="my-6 h-[1px] bg-border" />
                            <TeamSettings />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
