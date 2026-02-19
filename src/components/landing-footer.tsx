"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/contexts/LanguageContext";

export function LandingFooter() {
    const { t } = useLanguage();

    return (
        <footer className="w-full bg-background border-t border-border/40 pt-16 pb-8 px-4 md:px-6">
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-12">
                <div className="col-span-2 lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white">C</div>
                        <span className="text-xl font-bold">Centxo</span>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
                        Empowering marketing teams with AI-driven insights and automated workflows to scale faster and smarter.
                    </p>
                    <div className="flex gap-4">
                        {/* Social Icons Placeholder */}
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer">
                                <div className="w-4 h-4 rounded-sm bg-current opacity-50" />
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="font-bold mb-6">Product</h4>
                    <ul className="space-y-4 text-sm text-muted-foreground font-medium">
                        <li><Link href="#features" className="hover:text-primary transition-colors">Features</Link></li>
                        <li><Link href="#pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
                        <li><Link href="/adbox" className="hover:text-primary transition-colors">Adbox</Link></li>
                        <li><Link href="/campaigns" className="hover:text-primary transition-colors">Campaigns</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold mb-6">Company</h4>
                    <ul className="space-y-4 text-sm text-muted-foreground font-medium">
                        <li><Link href="/about" className="hover:text-primary transition-colors">About Us</Link></li>
                        <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
                        <li><Link href="/careers" className="hover:text-primary transition-colors">Careers</Link></li>
                        <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold mb-6">Legal</h4>
                    <ul className="space-y-4 text-sm text-muted-foreground font-medium">
                        <li><Link href="/terms" className="hover:text-primary transition-colors">{t('landing.footer.terms')}</Link></li>
                        <li><Link href="/privacy" className="hover:text-primary transition-colors">{t('landing.footer.privacy')}</Link></li>
                        <li><Link href="/data-deletion" className="hover:text-primary transition-colors">{t('landing.footer.deletion')}</Link></li>
                        <li className="pt-2"><LanguageToggle /></li>
                    </ul>
                </div>
            </div>

            <div className="max-w-7xl mx-auto pt-8 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} Centxo AI. All rights reserved.
                </p>
                <div className="flex gap-6 text-xs text-muted-foreground">
                    <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
                    <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
                    <Link href="/cookies" className="hover:text-primary">Cookie Settings</Link>
                </div>
            </div>
        </footer>
    );
}
