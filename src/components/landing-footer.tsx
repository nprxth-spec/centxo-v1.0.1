"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/contexts/LanguageContext";

export function LandingFooter() {
    const { t } = useLanguage();

    return (
        <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
            <p className="text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} Centxo. All rights reserved.
            </p>
            <nav className="sm:ml-auto flex gap-4 sm:gap-6 items-center">
                <Link href="/terms" className="text-xs hover:underline underline-offset-4">
                    {t('landing.footer.terms')}
                </Link>
                <Link href="/privacy" className="text-xs hover:underline underline-offset-4">
                    {t('landing.footer.privacy')}
                </Link>
                <Link href="/data-deletion" className="text-xs hover:underline underline-offset-4">
                    {t('landing.footer.deletion')}
                </Link>
                <LanguageToggle />
            </nav>
        </footer>
    );
}
