"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
    ArrowRight, Sparkles, Activity, Rocket, BrainCircuit, Globe,
    Command, MessageCircle, Layers, FileSpreadsheet, Target, ChevronDown, Palette, TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const features = [
    { icon: Rocket, key: 'createAds', accent: 'from-amber-500/20 to-orange-500/10 border-amber-500/20' },
    { icon: Activity, key: 'dashboard', accent: 'from-sky-500/20 to-blue-500/10 border-sky-500/20' },
    { icon: Globe, key: 'accounts', accent: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/20' },
    { icon: Layers, key: 'campaigns', accent: 'from-violet-500/20 to-purple-500/10 border-violet-500/20' },
    { icon: MessageCircle, key: 'adbox', accent: 'from-cyan-500/20 to-sky-500/10 border-cyan-500/20' },
    { icon: Command, key: 'autoRules', accent: 'from-pink-500/20 to-rose-500/10 border-pink-500/20' },
    { icon: Palette, key: 'creativeLab', accent: 'from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/20' },
    { icon: Target, key: 'audiences', accent: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/20' },
    { icon: FileSpreadsheet, key: 'export', accent: 'from-green-500/20 to-emerald-500/10 border-green-500/20' },
    { icon: BrainCircuit, key: 'aiOptimize', accent: 'from-purple-500/20 to-violet-500/10 border-purple-500/20' },
    { icon: Rocket, key: 'bulk', accent: 'from-orange-500/20 to-amber-500/10 border-orange-500/20' },
] as const;

export default function LandingPage() {
    const { status } = useSession();
    const router = useRouter();
    const { t } = useLanguage();
    const featuresRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (status === 'authenticated') router.push('/home');
    }, [status, router]);

    const scrollToFeatures = () => featuresRef.current?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
            {/* Premium background orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-[100px]" />
                <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-violet-500/[0.05] blur-[80px]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.03]" />
            </div>

            {/* Hero */}
            <section className="relative pt-12 pb-16 md:pt-16 md:pb-20">
                <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-4 backdrop-blur-sm">
                            <Sparkles className="h-4 w-4" />
                            <span className="text-sm font-medium">{t('landing.new.aiResponse')}</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-4">
                            {t('landing.hero.title1')}
                            <br />
                            <span className="bg-gradient-to-r from-primary via-violet-500 to-blue-500 bg-clip-text text-transparent">
                                {t('landing.hero.title2')}
                            </span>
                        </h1>
                        <p className="text-base md:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                            {t('landing.hero.subtitle')}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link href="/login">
                                <Button size="lg" className="h-12 px-8 rounded-lg text-base font-semibold">
                                    {t('landing.cta.start')} <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Button size="lg" variant="outline" onClick={scrollToFeatures} className="h-12 px-8 rounded-lg text-base font-medium hover:bg-muted/50">
                                {t('landing.cta.features')} <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </motion.div>

                    {/* Dashboard Chart Preview */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="mt-10"
                    >
                        <div className="rounded-lg border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-lg overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="inline-flex p-2 rounded-lg bg-primary/10 text-primary mb-2">
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-bold">{t('landing.dashboard.title')}</h3>
                                    <p className="text-sm text-muted-foreground">{t('landing.dashboard.desc')}</p>
                                </div>
                                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-medium flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" /> +24.5%
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="p-3 rounded-lg bg-background/80 dark:bg-background/50 border border-border/50">
                                    <div className="text-xs text-muted-foreground mb-0.5">{t('landing.dashboard.spend')}</div>
                                    <div className="text-lg font-bold">฿145,230</div>
                                </div>
                                <div className="p-3 rounded-lg bg-background/80 dark:bg-background/50 border border-border/50">
                                    <div className="text-xs text-muted-foreground mb-0.5">{t('landing.dashboard.revenue')}</div>
                                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">฿892,100</div>
                                </div>
                                <div className="p-3 rounded-lg bg-background/80 dark:bg-background/50 border border-border/50">
                                    <div className="text-xs text-muted-foreground mb-0.5">{t('landing.dashboard.roas')}</div>
                                    <div className="text-lg font-bold text-primary">6.14x</div>
                                </div>
                            </div>
                            <div className="h-36 rounded-lg bg-background/50 dark:bg-background/30 border border-border/50 p-3 flex items-end justify-between gap-1">
                                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((h, i) => (
                                    <div key={i} className="flex-1 bg-primary/30 rounded-t-md hover:bg-primary/40 transition-colors" style={{ height: `${h}%` }} />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features */}
            <section ref={featuresRef} className="relative py-12 md:py-16">
                <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-8"
                    >
                        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-2">
                            {t('landing.features.title')}
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                            {t('landing.features.subtitle')}
                        </p>
                    </motion.div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {features.map((feat, i) => (
                            <motion.div
                                key={feat.key}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.03 }}
                                className={`group relative overflow-hidden rounded-lg border bg-gradient-to-br ${feat.accent} p-4 shadow-sm hover:shadow-md transition-all`}
                            >
                                <div className="relative">
                                    <div className="inline-flex p-2 rounded-lg bg-background/80 dark:bg-background/50 text-primary mb-3">
                                        <feat.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-base font-bold text-foreground mb-2">
                                        {t(`landing.feat.${feat.key}.title`)}
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {t(`landing.feat.${feat.key}.desc`)}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="relative py-12 md:py-16">
                <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/15 via-primary/10 to-violet-500/10 border border-primary/20 px-6 py-10 text-center"
                    >
                        <div className="relative">
                            <h3 className="text-2xl font-bold text-foreground mb-2">
                                {t('landing.getStarted')}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                                {t('landing.cta.subtitle')}
                            </p>
                            <Link href="/login">
                                <Button size="lg" className="h-12 px-10 rounded-lg text-base font-semibold">
                                    {t('landing.cta.start')} <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
