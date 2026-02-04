'use client';

import { TeamSettings } from '@/components/settings/team-settings';
import { SettingsPageLayout } from '@/components/settings/settings-page-layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TeamSettingsPage() {
    const { t } = useLanguage();

    return (
        <SettingsPageLayout
            title={t('settings.team', 'Team')}
            subtitle={t('settings.teamSubtitle', "Manage your team's Facebook accounts")}
        >
            <TeamSettings />
        </SettingsPageLayout>
    );
}
