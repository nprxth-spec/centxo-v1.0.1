'use client';

/**
 * QuickLaunchContent - Quick ad launch wizard
 * Uses the existing LaunchWizard component
 */

import LaunchWizard from '@/components/launch-wizard';
import { useLanguage } from '@/contexts/LanguageContext';

export default function QuickLaunchContent() {
  const { t } = useLanguage();
  
  return (
    <div className="container max-w-2xl py-6 md:py-8 space-y-6">
      <div>
        <p className="text-muted-foreground">
          {t('launch.quick.subtitle', 'Create a new campaign in just a few clicks')}
        </p>
      </div>
      <LaunchWizard />
    </div>
  );
}
