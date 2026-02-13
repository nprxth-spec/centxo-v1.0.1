"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export default function PrivacyPage() {
    const { t } = useLanguage();

    return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                {t('legal.privacy.title')}
            </h1>

            <div className="space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.privacy.intro.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.privacy.intro.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.privacy.collect.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        {t('legal.privacy.collect.desc')}
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.collect.identity') }} />
                        <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.collect.contact') }} />
                        <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.collect.technical') }} />
                        <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.collect.usage') }} />
                        <li dangerouslySetInnerHTML={{ __html: t('legal.privacy.collect.ad') }} />
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.privacy.use.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        {t('legal.privacy.use.desc')}
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li>{t('legal.privacy.use.service')}</li>
                        <li>{t('legal.privacy.use.auth')}</li>
                        <li>{t('legal.privacy.use.improve')}</li>
                        <li>{t('legal.privacy.use.support')}</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.privacy.fb.title')}</h2>
                    <div
                        className="text-muted-foreground leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: t('legal.privacy.fb.desc') }}
                    />
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.privacy.google.title')}</h2>
                    <div
                        className="text-muted-foreground leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: t('legal.google.data.desc') }}
                    />
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.privacy.security.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.privacy.security.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.privacy.contact.title')}</h2>
                    <div className="bg-muted p-6 rounded-lg">
                        <p className="text-muted-foreground mb-2">{t('legal.privacy.contact.desc')}</p>
                        <ul className="list-none space-y-1">
                            <li className="font-medium">Email: privacy@centxo.com</li>
                            <li className="font-medium">Address: Bangkok, Thailand</li>
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
}
