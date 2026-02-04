"use client";

import { Button } from "@/components/ui/button";
import { motion, Variants } from "framer-motion";
import {
    BarChart3, ArrowRight, Zap, Target, MessageCircle,
    Sparkles, TrendingUp, DollarSign, Eye, MousePointer,
    Check, Users, Layers, Globe, Activity, Rocket,
    BrainCircuit, Bot, Command, Filter, RefreshCcw
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LandingPage() {
    const { status } = useSession();
    const router = useRouter();
    const { t } = useLanguage();

    useEffect(() => {
        if (status === 'authenticated') {
            router.push('/dashboard');
        }
    }, [status, router]);

    // Animation variants
    const container: Variants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.3
            }
        }
    };

    const item: Variants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } }
    };

    return (
        <div className="relative overflow-hidden min-h-screen">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[40%] left-[60%] w-[30%] h-[60%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-2000" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
            </div>

            <div className="container mx-auto px-4 sm:px-6 relative z-10 pt-20 pb-32">

                {/* Hero Text */}
                <div className="text-center max-w-4xl mx-auto mb-12 md:mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-8">
                            <Sparkles className="h-4 w-4" />
                            <span className="text-sm font-medium">{t('landing.new.aiResponse')}</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 md:mb-8 leading-[1.1]">
                            {t('landing.hero.title1')}<br />
                            <span className="bg-gradient-to-r from-primary via-purple-500 to-blue-500 bg-clip-text text-transparent">
                                {t('landing.hero.title2')}
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground mb-8 md:mb-10 max-w-2xl mx-auto px-4">
                            {t('landing.hero.subtitle')}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
                            <Link href="/login" className="w-full sm:w-auto">
                                <Button size="lg" className="w-full sm:w-auto h-14 px-8 rounded-full text-lg shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-105">
                                    {t('landing.cta.start')} <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 rounded-full text-lg hover:bg-muted/50">
                                {t('landing.cta.features')}
                            </Button>
                        </div>
                    </motion.div>
                </div>

                {/* Bento Grid */}
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 md:gap-6 max-w-7xl mx-auto"
                >
                    {/* Main Dashboard Card (Large) */}
                    <motion.div variants={item} className="md:col-span-6 lg:col-span-8 row-span-2 relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem]" />
                        <div className="h-full bg-card/50 backdrop-blur-sm border rounded-[2rem] p-6 md:p-8 overflow-hidden shadow-2xl relative hover:border-primary/50 transition-colors">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-4">
                                        <Activity className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2">{t('landing.dashboard.title')}</h3>
                                    <p className="text-muted-foreground">{t('landing.dashboard.desc')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm font-medium flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" /> +24.5%
                                    </span>
                                </div>
                            </div>

                            {/* Fake Chart/Stats Visual */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 rounded-2xl bg-background/80 border">
                                        <div className="text-sm text-muted-foreground mb-1">{t('landing.dashboard.spend')}</div>
                                        <div className="text-2xl font-bold">฿145,230</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-background/80 border">
                                        <div className="text-sm text-muted-foreground mb-1">{t('landing.dashboard.revenue')}</div>
                                        <div className="text-2xl font-bold text-green-500">฿892,100</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-background/80 border">
                                        <div className="text-sm text-muted-foreground mb-1">{t('landing.dashboard.roas')}</div>
                                        <div className="text-2xl font-bold text-blue-500">6.14x</div>
                                    </div>
                                </div>

                                {/* Graph Visual */}
                                <div className="h-48 w-full bg-background/50 rounded-2xl border p-4 relative flex items-end justify-between px-6 gap-2">
                                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((h, i) => (
                                        <div key={i} className="w-full bg-primary/20 rounded-t-lg relative group/bar" style={{ height: `${h}%` }}>
                                            <div className="absolute inset-0 bg-primary/50 rounded-t-lg opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                                        </div>
                                    ))}
                                    {/* Line Graph Overlay */}
                                    <svg className="absolute inset-0 h-full w-full p-4 pointer-events-none" preserveAspectRatio="none">
                                        <path d="M0,150 C20,120 40,160 60,100 S100,50 120,80 S160,20 200,40" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary opacity-50" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* AI Optimization (Medium) */}
                    <motion.div variants={item} className="md:col-span-6 lg:col-span-4 relative group">
                        <div className="h-full bg-gradient-to-br from-purple-500/5 to-blue-500/5 backdrop-blur-sm border rounded-[2rem] p-6 md:p-8 hover:border-purple-500/50 transition-colors">
                            <div className="inline-flex p-3 rounded-2xl bg-purple-500/10 text-purple-500 mb-4">
                                <BrainCircuit className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">{t('landing.ai.title')}</h3>
                            <p className="text-sm text-muted-foreground mb-6">{t('landing.ai.desc')}</p>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-background/60 border text-sm">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                                        <Check className="h-4 w-4 text-green-500" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-green-600">{t('landing.ai.budget')}</div>
                                        <div className="text-xs text-muted-foreground">{t('landing.ai.budgetDesc')}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-background/60 border text-sm">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <Check className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-blue-600">{t('landing.ai.audience')}</div>
                                        <div className="text-xs text-muted-foreground">{t('landing.ai.audienceDesc')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Multi-Account (Medium) */}
                    <motion.div variants={item} className="md:col-span-3 lg:col-span-4 relative group">
                        <div className="h-full bg-card/50 backdrop-blur-sm border rounded-[2rem] p-6 md:p-8 hover:border-blue-500/50 transition-colors">
                            <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 text-blue-500 mb-4">
                                <Globe className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">{t('landing.multi.title')}</h3>
                            <p className="text-sm text-muted-foreground mb-4">{t('landing.multi.desc')}</p>

                            <div className="flex -space-x-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-semibold">
                                        Acc
                                    </div>
                                ))}
                                <div className="w-10 h-10 rounded-full border-2 border-background bg-primary text-primary-foreground flex items-center justify-center text-xs">
                                    +99
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Bulk Launch (Wide) */}
                    <motion.div variants={item} className="md:col-span-3 lg:col-span-4 relative group">
                        <div className="h-full bg-card/50 backdrop-blur-sm border rounded-[2rem] p-6 md:p-8 hover:border-orange-500/50 transition-colors">
                            <div className="inline-flex p-3 rounded-2xl bg-orange-500/10 text-orange-500 mb-4">
                                <Rocket className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">{t('landing.bulk.title')}</h3>
                            <p className="text-sm text-muted-foreground mb-4">{t('landing.bulk.desc')}</p>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-2 bg-orange-500/20 rounded-full w-full animate-pulse" />
                                <div className="h-2 bg-orange-500/20 rounded-full w-3/4 animate-pulse delay-75" />
                                <div className="h-2 bg-orange-500/20 rounded-full w-1/2 animate-pulse delay-150" />
                                <div className="h-2 bg-orange-500/20 rounded-full w-full animate-pulse delay-200" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Automation Rules (Small) */}
                    <motion.div variants={item} className="md:col-span-6 lg:col-span-4 relative group">
                        <div className="h-full bg-card/50 backdrop-blur-sm border rounded-[2rem] p-6 md:p-8 hover:border-pink-500/50 transition-colors">
                            <div className="inline-flex p-3 rounded-2xl bg-pink-500/10 text-pink-500 mb-4">
                                <Command className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">{t('landing.auto.title')}</h3>
                            <p className="text-sm text-muted-foreground">
                                {t('landing.auto.desc1')}<br />
                                {t('landing.auto.desc2')}
                            </p>
                        </div>
                    </motion.div>

                    {/* Bot Integration (Small) */}
                    <motion.div variants={item} className="md:col-span-6 lg:col-span-4 relative group">
                        <div className="h-full bg-card/50 backdrop-blur-sm border rounded-[2rem] p-6 md:p-8 hover:border-cyan-500/50 transition-colors">
                            <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 text-cyan-500 mb-4">
                                <MessageCircle className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">{t('landing.bot.title')}</h3>
                            <p className="text-sm text-muted-foreground">
                                {t('landing.bot.desc')}
                            </p>
                        </div>
                    </motion.div>

                </motion.div>

                {/* Bottom CTA */}


            </div>
        </div>
    );
}
