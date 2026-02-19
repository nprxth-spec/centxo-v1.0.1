"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { LandingFooter } from "@/components/landing-footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/language-toggle";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <div className="flex items-center gap-2">
            <Logo />
          </div>
          <nav className="hidden md:ml-10 md:flex gap-8 items-center text-sm font-medium text-muted-foreground">
            <Link href="#product" className="hover:text-foreground transition-colors">{t('landing.nav.product')}</Link>
            <Link href="#features" className="hover:text-foreground transition-colors">{t('landing.nav.features')}</Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">{t('landing.nav.pricing')}</Link>
          </nav>
          <div className="ml-auto flex gap-4 items-center">
            <Link href="/login" className="hidden sm:block text-sm font-medium hover:text-foreground transition-colors">
              {t('login.signIn', 'Sign in')}
            </Link>
            <Link href="/login">
              <Button className="rounded-full px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                {t('landing.getStarted')}
              </Button>
            </Link>
            <div className="flex items-center gap-2 pl-2 border-l border-border/40">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
