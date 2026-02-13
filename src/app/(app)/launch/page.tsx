'use client';

import LaunchWizard from '@/components/launch-wizard';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LaunchPage() {
  const { t } = useLanguage();
  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-page-title">{t('launch.quick.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('launch.quick.subtitle')}
        </p>
        <Link href="/create?tab=auto" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2">
          {t('launch.quick.moreOptions')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <LaunchWizard />
    </div>
  );
}
