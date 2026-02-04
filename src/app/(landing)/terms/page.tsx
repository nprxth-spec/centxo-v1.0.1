"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TermsPage() {
    const { t } = useLanguage();

    return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                {t('legal.terms.title')}
            </h1>

            <div className="space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.agreement.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.terms.agreement.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.service.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        {t('legal.terms.service.desc')}
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li>{t('legal.terms.service.list1')}</li>
                        <li>{t('legal.terms.service.list2')}</li>
                        <li>{t('legal.terms.service.list3')}</li>
                        <li>{t('legal.terms.service.list4')}</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.account.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.terms.account.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.fb.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.terms.fb.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.google.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.terms.google.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.subs.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.terms.subs.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.data.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.terms.data.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.liability.title')}</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        {t('legal.terms.liability.desc')}
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 text-primary">{t('legal.terms.contact.title')}</h2>
                    <div className="bg-muted p-6 rounded-lg">
                        <p className="text-muted-foreground mb-2">{t('legal.terms.contact.desc')}</p>
                        <ul className="list-none space-y-1">
                            <li className="font-medium">Email: support@centxo.com</li>
                            <li className="font-medium">Address: Bangkok, Thailand</li>
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
}
