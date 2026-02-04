'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    User,
    CreditCard,
    Settings,
    Plug,
    Facebook,
    Languages,
} from 'lucide-react';
import { LanguageToggle } from './language-toggle';

// Import settings content components
import { GeneralSettings } from './settings/general-settings';
import { AdAccountsSettings } from './settings/ad-accounts-settings';
import { BillingSettings } from './settings/billing-settings';
import { IntegrationsSettings } from './settings/integrations-settings';
import { MetaSettings } from './settings/meta-settings';
import { LanguageSettings } from './settings/language-settings';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type SettingsSection = 'general' | 'ad-accounts' | 'billing' | 'integrations' | 'meta' | 'language';

const settingsSections = [
    {
        id: 'general' as SettingsSection,
        label: 'General',
        icon: User,
    },
    {
        id: 'ad-accounts' as SettingsSection,
        label: 'Ad Accounts',
        icon: Settings,
    },
    {
        id: 'integrations' as SettingsSection,
        label: 'Integrations',
        icon: Plug,
    },
    {
        id: 'meta' as SettingsSection,
        label: 'Meta',
        icon: Facebook,
    },
    {
        id: 'billing' as SettingsSection,
        label: 'Billing',
        icon: CreditCard,
    },
    {
        id: 'language' as SettingsSection,
        label: 'Language',
        icon: Languages,
    },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useLanguage();

    // Get initial section from URL or default to 'general'
    const urlSection = searchParams.get('section') as SettingsSection;
    const [activeSection, setActiveSection] = useState<SettingsSection>(
        urlSection || 'general'
    );

    // Update active section when URL changes (only when dialog is open)
    useEffect(() => {
        if (open && urlSection && urlSection !== activeSection) {
            setActiveSection(urlSection);
        }
    }, [urlSection, open]);

    // Aggressive cleanup of body styles when dialog closes
    useEffect(() => {
        if (!open) {
            // Immediate cleanup
            const cleanup = () => {
                document.body.style.pointerEvents = '';
                document.body.style.overflow = '';
                // Also remove any data attributes that Radix might set
                document.body.removeAttribute('data-scroll-locked');
            };

            cleanup();

            // Delayed cleanup to catch any race conditions
            const timer1 = setTimeout(cleanup, 100);
            const timer2 = setTimeout(cleanup, 300);
            const timer3 = setTimeout(cleanup, 500);

            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
            };
        }
    }, [open]);

    const renderContent = () => {
        switch (activeSection) {
            case 'general':
                return <GeneralSettings />;
            case 'ad-accounts':
                return <AdAccountsSettings />;
            case 'billing':
                return <BillingSettings />;
            case 'integrations':
                return <IntegrationsSettings />;
            case 'meta':
                return <MetaSettings />;
            case 'language':
                return <LanguageSettings />;
            default:
                return <GeneralSettings />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle className="text-2xl font-bold">
                        {t('settings.title', 'Settings')}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex h-[calc(85vh-73px)] overflow-hidden">{/* Subtract header height */}
                    {/* Sidebar */}
                    <div className="w-64 border-r bg-muted/10">
                        <ScrollArea className="h-full py-4">
                            <nav className="space-y-1 px-3">
                                {settingsSections.map((section) => {
                                    const Icon = section.icon;
                                    const isActive = activeSection === section.id;

                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => setActiveSection(section.id)}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                                                isActive
                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {section.label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </ScrollArea>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="p-6">
                                {renderContent()}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
