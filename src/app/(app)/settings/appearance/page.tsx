'use client';

import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { SettingsPageLayout } from '@/components/settings/settings-page-layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AppearanceSettingsPage() {
    const { t } = useLanguage();

    return (
        <SettingsPageLayout
            title={t('settings.appearance', 'Appearance')}
            subtitle={t('settings.appearanceSubtitle', 'Customize the appearance of the application')}
        >
            <AppearanceSettings />
        </SettingsPageLayout>
    );
}
