'use client';

import { AdAccountsSettings } from '@/components/settings/ad-accounts-settings';
import { SettingsPageLayout } from '@/components/settings/settings-page-layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdAccountsSettingsPage() {
    const { t } = useLanguage();

    return (
        <SettingsPageLayout
            title={t('settings.adAccounts', 'Ad Accounts')}
            subtitle={t('settings.adAccountsSubtitle', 'Manage your advertising accounts and pages')}
        >
            <AdAccountsSettings />
        </SettingsPageLayout>
    );
}
