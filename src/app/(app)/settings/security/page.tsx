'use client';

import { SecuritySettings } from '@/components/settings/security-settings';
import { SettingsPageLayout } from '@/components/settings/settings-page-layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SecuritySettingsPage() {
    const { t } = useLanguage();

    return (
        <SettingsPageLayout
            title={t('settings.security', 'Security')}
            subtitle={t('settings.securitySubtitle', 'Manage your password and security settings')}
        >
            <SecuritySettings />
        </SettingsPageLayout>
    );
}
