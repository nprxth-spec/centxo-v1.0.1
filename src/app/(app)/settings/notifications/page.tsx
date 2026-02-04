'use client';

import { NotificationsSettings } from '@/components/settings/notifications-settings';
import { SettingsPageLayout } from '@/components/settings/settings-page-layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function NotificationsSettingsPage() {
    const { t } = useLanguage();

    return (
        <SettingsPageLayout
            title={t('settings.notifications', 'Notifications')}
            subtitle={t('settings.notificationsSubtitle', 'Configure how you receive notifications')}
        >
            <NotificationsSettings />
        </SettingsPageLayout>
    );
}
