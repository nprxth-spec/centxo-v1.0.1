'use client';

import { LanguageSettings } from '@/components/settings/language-settings';
import { SettingsPageLayout } from '@/components/settings/settings-page-layout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSettingsPage() {
    const { t, language } = useLanguage();

    return (
        <SettingsPageLayout
            title={t('settings.language', 'Language')}
            subtitle={language === 'th'
                ? 'เลือกภาษาที่คุณต้องการใช้ในแอปพลิเคชัน'
                : 'Select your preferred language for the application'
            }
        >
            <LanguageSettings />
        </SettingsPageLayout>
    );
}
