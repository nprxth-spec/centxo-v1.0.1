'use client';

import { DeleteAccountSettings } from '@/components/settings/delete-account-settings';
import { SettingsPageLayout } from '@/components/settings/settings-page-layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DeleteAccountPage() {
    const { t } = useLanguage();

    return (
        <SettingsPageLayout
            title={t('settings.delete.title', 'Delete Account')}
            subtitle={t('settings.delete.subtitle', 'Permanently delete your account and all associated data')}
        >
            <DeleteAccountSettings />
        </SettingsPageLayout>
    );
}
