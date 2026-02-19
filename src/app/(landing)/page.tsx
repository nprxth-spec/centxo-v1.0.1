"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
    ArrowRight, Sparkles, Activity, Rocket, BrainCircuit, Globe,
    Command, MessageCircle, Layers, FileSpreadsheet, Target, ChevronDown, Palette, TrendingUp,
    ShieldCheck, Zap, Users2, Star, BarChart3, Send, Archive, User, Wrench, Settings, MessageSquare, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const features = [
    { icon: Activity, key: 'adsManager', accent: 'from-sky-500/20 to-blue-500/10 border-sky-500/20' },
    { icon: MessageCircle, key: 'inbox', accent: 'from-cyan-500/20 to-sky-500/10 border-cyan-500/20' },
    { icon: Command, key: 'autoRules', accent: 'from-pink-500/20 to-rose-500/10 border-pink-500/20' },
    { icon: Palette, key: 'creativeLab', accent: 'from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/20' },
    { icon: FileSpreadsheet, key: 'export', accent: 'from-green-500/20 to-emerald-500/10 border-green-500/20' },
    { icon: BrainCircuit, key: 'aiOptimize', accent: 'from-purple-500/20 to-violet-500/10 border-purple-500/20' },
    { icon: Zap, key: 'creativeFatigue', accent: 'from-amber-500/20 to-orange-500/10 border-amber-500/20' },
    { icon: Target, key: 'audiences', accent: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/20' },
    { icon: BarChart3, key: 'dashboard', accent: 'from-sky-500/20 to-blue-500/10 border-sky-500/20' },
] as const;

function Reveal({ children, width = "fit-content", delay = 0 }: { children: React.ReactNode, width?: "fit-content" | "100%", delay?: number }) {
    return (
        <div style={{ position: "relative", width, overflow: "hidden" }}>
            <motion.div
                variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: { opacity: 1, y: 0 },
                }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
            >
                {children}
            </motion.div>
        </div>
    );
}


const FAQSection = () => {
    const { t } = useLanguage();
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs = [
        { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
        { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
        { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    ];

    return (
        <section className="py-24 md:py-32">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('landing.faq.title')}</h2>
                    <p className="text-muted-foreground">{t('landing.faq.subtitle')}</p>
                </div>
                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <div key={i} className="glass-card overflow-hidden">
                            <button
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                className="w-full p-6 text-left flex justify-between items-center hover:bg-muted/30 transition-colors"
                            >
                                <span className="font-bold">{faq.q}</span>
                                <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`} />
                            </button>
                            <motion.div
                                initial={false}
                                animate={{ height: openIndex === i ? 'auto' : 0, opacity: openIndex === i ? 1 : 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-6 pt-0 text-muted-foreground text-sm leading-relaxed border-t border-border/10">
                                    {faq.a}
                                </div>
                            </motion.div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default function LandingPage() {
    const { status } = useSession();
    const router = useRouter();
    const { t, isReady: langReady } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const featuresRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    useEffect(() => {
        if (status === 'authenticated') router.push('/dashboard');
    }, [status, router]);

    const scrollToFeatures = () => featuresRef.current?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div ref={containerRef} className="relative min-h-screen bg-background selection:bg-primary/30 selection:text-foreground overflow-x-hidden">
            {!mounted ? null : (
                <>
                    {/* Background Effects */}
                    <div className="fixed inset-0 pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px] animate-pulse" />
                        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f1f1f_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />
                    </div>

                    {/* Hero Section */}
                    <Reveal width="100%">
                        <section className="relative pt-20 pb-24 md:pt-32 md:pb-32">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="grid lg:grid-cols-2 gap-12 items-center">
                                    {/* Text Content */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                        className="z-10"
                                    >
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 }}
                                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-6 backdrop-blur-sm"
                                        >
                                            <Sparkles className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">{t('landing.hero.badge')}</span>
                                        </motion.div>

                                        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.05] mb-8">
                                            {t('landing.hero.title1')}<span className="text-gradient">{t('landing.hero.title2')}</span>
                                            <br />
                                            {t('landing.hero.title3')}
                                        </h1>

                                        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed">
                                            {t('landing.hero.subtitle')}
                                        </p>

                                        <div className="flex flex-wrap gap-4">
                                            <Link href="/login">
                                                <Button size="lg" className="h-14 px-8 rounded-full text-base font-bold btn-premium">
                                                    {t('landing.cta.start')}
                                                </Button>
                                            </Link>
                                            <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-base font-bold glass" onClick={scrollToFeatures}>
                                                {t('landing.cta.features')}
                                            </Button>
                                        </div>

                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.5 }}
                                            className="mt-12 flex items-center gap-6"
                                        >
                                            <div className="flex -space-x-3">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-muted overflow-hidden">
                                                        <img src={`https://i.pravatar.cc/100?u=${i}`} alt="User" className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-sm">
                                                <div className="flex items-center text-amber-500 mb-0.5">
                                                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-4 w-4 fill-current" />)}
                                                </div>
                                                <p className="text-muted-foreground font-medium">Loved by <span className="text-foreground">10,000+</span> teams worldwide</p>
                                            </div>
                                        </motion.div>
                                    </motion.div>

                                    {/* Visual Asset - Focused on Features */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                                        className="relative hidden lg:block"
                                    >
                                        <div className="relative w-full aspect-square max-w-[500px] mx-auto">
                                            {/* Main Feature: Ads Manager (Performance) */}
                                            <motion.div
                                                animate={{ y: [0, -20, 0] }}
                                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute inset-0 flex items-center justify-center p-8"
                                            >
                                                <div className="w-full h-full glass-premium rounded-3xl border border-primary/20 shadow-2xl flex flex-col p-8 overflow-hidden">
                                                    <div className="flex justify-between items-center mb-8">
                                                        <div>
                                                            <h4 className="font-bold text-lg mb-1">Campaign ROAS</h4>
                                                            <p className="text-sm text-muted-foreground">Last 7 days performance</p>
                                                        </div>
                                                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                                            <BarChart3 className="h-6 w-6" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 flex items-end gap-2 mb-4">
                                                        {[40, 60, 45, 80, 55, 95, 75].map((h, i) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ height: 0 }}
                                                                animate={{ height: `${h}%` }}
                                                                transition={{ delay: 0.5 + (i * 0.1), duration: 0.8 }}
                                                                className="flex-1 bg-gradient-to-t from-primary/40 to-primary rounded-t-lg"
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase opacity-50">
                                                        <span>Mon</span>
                                                        <span>Wed</span>
                                                        <span>Fri</span>
                                                        <span>Sun</span>
                                                    </div>
                                                </div>
                                            </motion.div>

                                            {/* Floating Feature: Create Ads (Sparkles/AI) */}
                                            <motion.div
                                                animate={{ x: [0, 20, 0], y: [0, 10, 0], rotate: [0, 3, 0] }}
                                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute -top-6 -right-6 glass-premium px-6 py-4 rounded-2xl shadow-2xl border border-violet-500/20 flex items-center gap-4 z-20"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white shadow-lg">
                                                    <Sparkles className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">AI Generation</p>
                                                    <div className="flex gap-1 mt-1">
                                                        {[1, 2, 3].map(i => <div key={i} className="w-8 h-1 bg-violet-400/30 rounded-full" />)}
                                                    </div>
                                                </div>
                                            </motion.div>

                                            {/* Floating Feature: Inbox (Conversations) */}
                                            <motion.div
                                                animate={{ x: [0, -15, 0], y: [0, 15, 0], rotate: [0, -5, 0] }}
                                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute -bottom-6 -left-6 glass-premium p-4 rounded-2xl shadow-2xl border border-emerald-500/20 flex items-center gap-4 z-20"
                                            >
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                        <MessageSquare className="h-6 w-6" />
                                                    </div>
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold">New Message</p>
                                                    <p className="text-[10px] text-muted-foreground">Order inquiry #482</p>
                                                </div>
                                            </motion.div>

                                            {/* Floating Feature: Accounts (Identity) */}
                                            <motion.div
                                                animate={{ y: [0, 25, 0] }}
                                                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute top-1/2 -right-8 glass-premium p-3 rounded-xl shadow-2xl border border-primary/20 flex items-center gap-3 z-10"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    <User className="h-5 w-5" />
                                                </div>
                                                <div className="hidden sm:block">
                                                    <div className="w-16 h-2 bg-foreground/10 rounded mb-1" />
                                                    <div className="w-12 h-1.5 bg-muted rounded" />
                                                </div>
                                            </motion.div>

                                            {/* Background Circles */}
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-primary/10 rounded-full pointer-events-none" />
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] border border-primary/5 rounded-full pointer-events-none" />
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </section>
                    </Reveal>


                    {/* Workflow Section */}
                    <Reveal width="100%">
                        <section className="relative py-24 md:py-32 bg-muted/50 overflow-hidden">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="grid lg:grid-cols-2 gap-16 items-center">
                                    <motion.div
                                        initial={{ opacity: 0, x: -30 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                    >
                                        <h2 className="text-3xl md:text-4xl font-bold mb-8">
                                            {t('landing.workflow.title')}
                                        </h2>
                                        <div className="space-y-8">
                                            {[
                                                { step: '01', title: t('landing.workflow.step1.title'), desc: t('landing.workflow.step1.desc') },
                                                { step: '02', title: t('landing.workflow.step2.title'), desc: t('landing.workflow.step2.desc') },
                                                { step: '03', title: t('landing.workflow.step3.title'), desc: t('landing.workflow.step3.desc') },
                                            ].map((step, i) => (
                                                <div key={i} className="flex gap-6">
                                                    <div className="text-2xl font-black text-primary/20">{step.step}</div>
                                                    <div>
                                                        <h4 className="font-bold mb-1">{step.title}</h4>
                                                        <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        className="glass-card p-0 aspect-[16/10] relative overflow-hidden shadow-2xl"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-violet-500/5" />
                                        <div className="relative z-10 w-full h-full flex flex-col">
                                            {/* Browser-style Header */}
                                            <div className="h-8 border-b border-border/40 bg-muted/30 px-3 flex items-center justify-between">
                                                <div className="flex gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-red-400/50" />
                                                    <div className="w-2 h-2 rounded-full bg-amber-400/50" />
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400/50" />
                                                </div>
                                                <div className="bg-background/50 px-2 py-0.5 rounded text-[8px] text-muted-foreground border border-border/20">centxo.online/home</div>
                                                <div className="w-10" />
                                            </div>

                                            <div className="flex-1 flex overflow-hidden">
                                                {/* Mock Sidebar */}
                                                <div className="w-16 md:w-20 border-r border-border/40 bg-card/30 flex flex-col py-4 gap-4 items-center">
                                                    <div className="w-8 h-8 rounded-lg bg-primary mb-2 flex items-center justify-center font-bold text-white text-[10px]">C</div>
                                                    {[User, BarChart3, Rocket, MessageSquare, Wrench].map((Icon, i) => (
                                                        <div key={i} className={`p-2 rounded-lg ${i === 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground opacity-50'}`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                    ))}
                                                    <div className="mt-auto mb-2">
                                                        <div className="w-8 h-8 rounded-full bg-muted/50 p-1.5">
                                                            <Settings className="w-full h-full text-muted-foreground opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Mock Dashboard Content */}
                                                <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="w-24 h-4 bg-foreground/10 rounded mb-1" />
                                                            <div className="w-16 h-2 bg-muted rounded" />
                                                        </div>
                                                        <div className="w-20 h-8 bg-primary rounded-lg" />
                                                    </div>

                                                    {/* Stats Cards Row */}
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {[1, 2, 3].map(i => (
                                                            <div key={i} className="p-3 rounded-xl border border-border/40 bg-background/50">
                                                                <div className="w-8 h-2 bg-muted rounded mb-2" />
                                                                <div className="w-12 h-4 bg-foreground/10 rounded" />
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Chart Placeholder */}
                                                    <div className="flex-1 rounded-2xl border border-border/40 bg-background/30 p-4 relative overflow-hidden">
                                                        <div className="absolute inset-0 opacity-10">
                                                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                                <path d="M0 80 Q 20 60, 40 70 T 80 30 T 100 20" fill="none" stroke="currentColor" strokeWidth="2" />
                                                                <path d="M0 80 Q 20 60, 40 70 T 80 30 T 100 20 L 100 100 L 0 100 Z" fill="currentColor" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex justify-between items-end h-full">
                                                            {[...Array(6)].map((_, i) => (
                                                                <div key={i} className="w-2 md:w-4 bg-primary/20 rounded-t" style={{ height: `${20 + Math.random() * 60}%` }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </section>
                    </Reveal>

                    {/* Feature Spotlight: AI Auto Ads */}
                    <Reveal width="100%">
                        <section id="ai-auto-ads" className="py-24 md:py-32 relative overflow-hidden bg-muted/30">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="grid lg:grid-cols-2 gap-16 items-center">
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        className="lg:order-2"
                                    >
                                        <h2 className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-4">Automation</h2>
                                        <h3 className="text-3xl md:text-4xl font-bold mb-6">{t('landing.autocreate.title')}</h3>
                                        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                                            {t('landing.autocreate.subtitle')}
                                        </p>
                                        <ul className="space-y-4">
                                            {[
                                                { title: 'Identity & creative', desc: 'Securely select your page and upload your media.' },
                                                { title: 'AI Strategy', desc: 'Let AI find the perfect interests and target audience for you.' },
                                                { title: 'Automatic Messaging', desc: 'Generate high-converting headlines and FAQs automatically.' },
                                            ].map((item, i) => (
                                                <li key={i} className="flex gap-4">
                                                    <div className="mt-1 p-1 rounded-full bg-primary/10 text-primary">
                                                        <Sparkles className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold">{item.title}</p>
                                                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        className="lg:order-1 glass-card p-0 aspect-[4/3] relative overflow-hidden shadow-2xl bg-background/50 border-border/40"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-violet-500/5" />
                                        <div className="relative z-10 w-full h-full flex flex-col">
                                            <div className="p-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <Rocket className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <span className="font-bold text-sm">AI Auto Creation Wizard</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <div key={s} className={`w-1.5 h-1.5 rounded-full ${s === 3 ? 'bg-primary' : 'bg-muted'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex-1 p-6 flex flex-col gap-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <div className="w-32 h-4 bg-foreground/10 rounded mb-1" />
                                                        <div className="w-48 h-2 bg-muted rounded" />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-muted/50" />
                                                        <div className="w-8 h-8 rounded-full bg-muted/50" />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6 h-full">
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <div className="w-20 h-2 bg-muted rounded" />
                                                            <div className="w-full h-10 rounded-lg border border-border/40 bg-background/50" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="w-24 h-2 bg-muted rounded" />
                                                            <div className="w-full h-24 rounded-lg border border-border/40 bg-background/50 flex items-center justify-center">
                                                                <Sparkles className="w-6 h-6 text-primary/20" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-4">
                                                        <div className="w-full aspect-video rounded-lg bg-background/50 border border-border/20 flex items-center justify-center relative overflow-hidden">
                                                            <Play className="w-8 h-8 text-primary/40" />
                                                            <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/30" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="w-full h-2 bg-foreground/5 rounded" />
                                                            <div className="w-3/4 h-2 bg-foreground/5 rounded" />
                                                            <div className="w-1/2 h-2 bg-foreground/5 rounded" />
                                                        </div>
                                                        <div className="pt-2 flex gap-1">
                                                            <div className="w-4 h-4 rounded-full bg-muted" />
                                                            <div className="w-16 h-2 bg-muted rounded mt-1" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-auto flex justify-between">
                                                    <div className="w-16 h-8 rounded-lg border border-border/40 bg-background" />
                                                    <div className="w-24 h-8 rounded-lg bg-primary" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </section>
                    </Reveal>

                    {/* Feature Spotlight: Ads Manager */}
                    <Reveal width="100%">
                        <section id="ads-manager" className="py-24 md:py-32 relative">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="grid lg:grid-cols-2 gap-16 items-center">
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                    >
                                        <h2 className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-4">Performance</h2>
                                        <h3 className="text-3xl md:text-4xl font-bold mb-6">{t('landing.adsManager.title')}</h3>
                                        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                                            {t('landing.adsManager.subtitle')}
                                        </p>
                                        <div className="grid sm:grid-cols-2 gap-6">
                                            {[
                                                { title: 'Multi-Account Sync', desc: 'Manage 50+ ad accounts in one dashboard.', icon: Globe },
                                                { title: 'Real-time Stats', desc: 'No more 15-minute delays. See results live.', icon: Zap },
                                                { title: 'Automated Rules', desc: 'Protect your budget with custom pause rules.', icon: Command },
                                                { title: 'Bulk Actions', desc: 'Update budgets and status in one click.', icon: Layers },
                                            ].map((item, i) => (
                                                <div key={i} className="p-4 rounded-xl border border-border/40 bg-background/50 hover:bg-muted/10 transition-colors">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <item.icon className="h-4 w-4 text-primary" />
                                                        <p className="font-bold text-sm">{item.title}</p>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        className="glass-card p-0 aspect-[16/10] relative overflow-hidden shadow-2xl bg-background/50 border-border/40"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-violet-500/5" />

                                        {/* Dashboard Header */}
                                        <div className="relative z-10 p-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg">
                                                    <Activity className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-xs">Campaign Manager</h4>
                                                    <p className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider">ROAS Optimizing</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="w-20 h-7 rounded-lg bg-background/50 border border-border/40" />
                                                <div className="w-20 h-7 rounded-lg bg-primary" />
                                            </div>
                                        </div>

                                        {/* Table Layout */}
                                        <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
                                            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border/20 text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted/5">
                                                <div className="col-span-1">Status</div>
                                                <div className="col-span-5">Campaign Name</div>
                                                <div className="col-span-2 text-right">Reach</div>
                                                <div className="col-span-2 text-right">CTR</div>
                                                <div className="col-span-2 text-right">ROAS</div>
                                            </div>

                                            <div className="flex-1 overflow-hidden">
                                                {[
                                                    { name: 'US_Summer_Sale_Vid_01', status: 'ACTIVE', reach: '124.5k', ctr: '3.2%', roas: '4.8x', on: true },
                                                    { name: 'TH_New_Arrival_Creative_A', status: 'ACTIVE', reach: '82.1k', ctr: '2.8%', roas: '5.2x', on: true },
                                                    { name: 'Global_Retargeting_LAL_1%', status: 'PAUSED', reach: '45.0k', ctr: '1.2%', roas: '0.8x', on: false },
                                                    { name: 'EU_Prospecting_Collection', status: 'ACTIVE', reach: '210.3k', ctr: '4.1%', roas: '3.9x', on: true },
                                                ].map((ad, i) => (
                                                    <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/10 items-center hover:bg-muted/10 transition-colors">
                                                        <div className="col-span-1">
                                                            <div className={`w-7 h-4 rounded-full relative transition-colors duration-300 ${ad.on ? 'bg-primary' : 'bg-muted'}`}>
                                                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${ad.on ? 'left-3.5' : 'left-0.5'}`} />
                                                            </div>
                                                        </div>
                                                        <div className="col-span-5 flex flex-col">
                                                            <span className="text-[10px] font-bold text-foreground truncate">{ad.name}</span>
                                                            <span className={`text-[8px] font-black ${ad.status === 'ACTIVE' ? 'text-emerald-500' : 'text-amber-500'}`}>{ad.status}</span>
                                                        </div>
                                                        <div className="col-span-2 text-right text-[10px] font-bold">{ad.reach}</div>
                                                        <div className="col-span-2 text-right text-[10px] font-bold">{ad.ctr}</div>
                                                        <div className="col-span-2 text-right text-[10px] font-bold text-emerald-500">{ad.roas}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Status Bar */}
                                            <div className="p-4 border-t border-border/40 bg-muted/5 flex justify-between items-center mt-auto">
                                                <div className="flex gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Live Impressions</p>
                                                        <p className="text-xs font-black">462,091</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Avg. CPC</p>
                                                        <p className="text-xs font-black">฿4.20</p>
                                                    </div>
                                                </div>
                                                <div className="flex -space-x-2">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className="w-6 h-6 rounded-full border border-background bg-muted" />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </section>
                    </Reveal>

                    {/* Feature Spotlight: Inbox */}
                    <Reveal width="100%">
                        <section className="py-24 md:py-32 relative">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="grid lg:grid-cols-2 gap-12 items-center">
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                    >
                                        <h2 className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-4">Customer Experience</h2>
                                        <h3 className="text-3xl md:text-4xl font-bold mb-6">{t('landing.inbox.title')}</h3>
                                        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                                            {t('landing.inbox.subtitle')}
                                        </p>
                                        <ul className="space-y-4">
                                            {[
                                                { title: 'Unified Inbox', desc: 'Sync all your Facebook Pages into one clear message view.' },
                                                { title: 'AI Automation', desc: 'Automatically handle common questions and triage leads.' },
                                                { title: 'Ad Context', desc: 'See exactly which ad the customer clicked before they even speak.' },
                                            ].map((item, i) => (
                                                <li key={i} className="flex gap-4">
                                                    <div className="mt-1 p-1 rounded-full bg-primary/10 text-primary">
                                                        <ShieldCheck className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold">{item.title}</p>
                                                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        className="glass-card overflow-hidden shadow-2xl bg-background/50 border-border/40 h-[400px] flex flex-col"
                                    >
                                        {/* Mock Inbox Header */}
                                        <div className="p-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <MessageCircle className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className="font-bold text-sm">Inbox Unified Inbox</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase">Live</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex min-h-0">
                                            {/* Mock Conv List */}
                                            <div className="w-1/3 border-r border-border/40 bg-muted/5 flex flex-col">
                                                {[
                                                    { name: 'Somsak K.', msg: 'How much is the shipping?', time: '2m', active: true },
                                                    { name: 'Kanya P.', msg: 'Do you have size L?', time: '15m', active: false },
                                                    { name: 'Wichai R.', msg: 'Order received, thanks!', time: '1h', active: false },
                                                ].map((c, i) => (
                                                    <div key={i} className={`p-4 border-b border-border/40 ${c.active ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-bold text-xs truncate">{c.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">{c.time}</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground truncate">{c.msg}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Mock Chat */}
                                            <div className="flex-1 p-4 flex flex-col gap-4 bg-background/30">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                                                    <div className="bg-muted/50 p-3 rounded-2xl rounded-tl-none text-xs max-w-[80%]">
                                                        Hello! I saw your ad for the Summer Collection. Is the blue dress still in stock?
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3 justify-end">
                                                    <div className="bg-primary p-3 rounded-2xl rounded-tr-none text-xs text-white max-w-[80%] shadow-lg shadow-primary/20">
                                                        Yes, it is! We have sizes S, M, and L available. Would you like a size chart?
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-primary shrink-0" />
                                                </div>
                                                <div className="mt-auto flex gap-2">
                                                    <div className="flex-1 h-8 rounded-full bg-muted/50 border border-border/40 px-3 flex items-center text-[10px] text-muted-foreground">
                                                        Type a message...
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                                                        <Send className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </section>
                    </Reveal>

                    {/* Feature Spotlight: Creative Lab */}
                    <Reveal width="100%">
                        <section className="py-24 md:py-32 bg-muted/30">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="grid lg:grid-cols-2 gap-12 items-center">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        className="order-last lg:order-first glass-card overflow-hidden shadow-2xl bg-background/50 border-border/40 h-[400px] flex flex-col"
                                    >
                                        {/* Mock Creative Header */}
                                        <div className="p-4 border-b border-border/40 bg-muted/20 flex items-center gap-4">
                                            <span className="font-bold text-sm text-primary">AI Creative Lab</span>
                                            <div className="flex gap-2">
                                                <div className="px-2 py-0.5 rounded bg-primary/10 text-[10px] font-bold text-primary">Auto Create</div>
                                                <div className="px-2 py-0.5 rounded text-[10px] font-bold text-muted-foreground">Quick Launch</div>
                                            </div>
                                        </div>
                                        {/* Mock Creative Workspace */}
                                        <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Target Intent</p>
                                                <div className="p-3 rounded-xl bg-muted/50 border border-border/40 text-xs text-foreground/80 leading-relaxed italic">
                                                    "Generate a high-converting ad for my new eco-friendly water bottles targeting outdoor enthusiasts."
                                                </div>
                                            </div>
                                            <div className="space-y-3 flex-1 overflow-hidden">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">AI Generated Variants</p>
                                                <div className="grid grid-cols-2 gap-4 h-full">
                                                    {[
                                                        { title: 'The Adventurer', copy: 'Stay hydrated on your next peak. Eco-friendly, durable, stylish.', color: 'bg-emerald-500/10' },
                                                        { title: 'Eco-Warrior', copy: 'Say no to plastic. Join the revolution with our zero-waste bottle.', color: 'bg-sky-500/10' },
                                                    ].map((card, i) => (
                                                        <div key={i} className="rounded-xl border border-border/40 overflow-hidden flex flex-col bg-background/50 group hover:border-primary/50 transition-colors">
                                                            <div className={`h-20 ${card.color} flex items-center justify-center`}>
                                                                <Sparkles className="h-6 w-6 text-primary/40 group-hover:scale-110 transition-transform" />
                                                            </div>
                                                            <div className="p-3">
                                                                <p className="font-bold text-[10px] mb-1">{card.title}</p>
                                                                <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2">{card.copy}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                    >
                                        <h2 className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-4">Content Production</h2>
                                        <h3 className="text-3xl md:text-4xl font-bold mb-6">{t('landing.creative.title')}</h3>
                                        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                                            {t('landing.creative.subtitle')}
                                        </p>
                                        <div className="grid sm:grid-cols-2 gap-6">
                                            {[
                                                { title: 'AI Copywriter', desc: 'Hook-driven copies for any audience.', icon: Sparkles },
                                                { title: 'Image Generator', desc: 'Stunning visuals with consistent branding.', icon: Palette },
                                                { title: 'A/B Testing', desc: 'Automatically launch and test variants.', icon: Command },
                                                { title: 'Media Library', desc: 'Unified assets across all your brands.', icon: Archive },
                                            ].map((item, i) => (
                                                <div key={i} className="p-4 rounded-xl border border-border/40 bg-background/50 hover:bg-muted/10 transition-colors">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <item.icon className="h-4 w-4 text-primary" />
                                                        <p className="font-bold text-sm">{item.title}</p>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        </section>
                    </Reveal>
                    {/* Deep Insights Branding Section */}
                    <Reveal width="100%">
                        <section className="py-24 md:py-32 bg-background relative overflow-hidden">
                            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="text-center max-w-4xl mx-auto"
                                >
                                    <h2 className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-4">{t('landing.insights.title')}</h2>
                                    <h3 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
                                        {t('landing.insights.subtitle')}
                                    </h3>
                                    <p className="text-xl text-muted-foreground leading-relaxed">
                                        {t('landing.insights.desc')}
                                    </p>

                                    <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {[
                                            { title: 'Focus', desc: 'Eliminate distractions with a unified view.' },
                                            { title: 'Speed', desc: 'Sync and manage at the speed of thought.' },
                                            { title: 'Scalability', desc: 'Built to handle thousands of campaigns.' }
                                        ].map((item, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 20 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: i * 0.1 }}
                                                className="p-6 rounded-2xl bg-muted/20 border border-border/40"
                                            >
                                                <h4 className="font-bold mb-2">{item.title}</h4>
                                                <p className="text-sm text-muted-foreground">{item.desc}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            </div>
                        </section>
                    </Reveal>

                    {/* Features Section */}
                    <Reveal width="100%">
                        <section ref={featuresRef} id="features" className="relative py-24 md:py-32">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="text-center mb-20"
                                >
                                    <h2 className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-4">{t('landing.features.title')}</h2>
                                    <h3 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                                        {t('landing.features.subtitle')}
                                    </h3>
                                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                        {t('landing.features.desc')}
                                    </p>
                                </motion.div>

                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                                    {features.map((feat, i) => (
                                        <motion.div
                                            key={feat.key}
                                            initial={{ opacity: 0, y: 30 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: i * 0.05 }}
                                            className="group relative glass-card p-8 hover:border-primary/50 transition-all duration-300"
                                        >
                                            <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feat.accent} text-primary mb-6 group-hover:scale-110 transition-transform`}>
                                                <feat.icon className="h-6 w-6" />
                                            </div>
                                            <h4 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                                                {t(`landing.feat.${feat.key}.title`)}
                                            </h4>
                                            <p className="text-muted-foreground leading-relaxed text-sm mb-6">
                                                {t(`landing.feat.${feat.key}.desc`)}
                                            </p>
                                            <Link href="/login" className="inline-flex items-center text-sm font-bold text-primary group-hover:translate-x-1 transition-transform">
                                                Learn more <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </Reveal>

                    {/* Pricing Section */}
                    <Reveal width="100%">
                        <section id="pricing" className="py-24 md:py-32 bg-muted/30">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="text-center mb-16">
                                    <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('landing.pricing.title')}</h2>
                                    <p className="text-muted-foreground">{t('landing.pricing.subtitle')}</p>
                                </div>

                                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                                    {[
                                        { name: t('landing.pricing.free.name'), price: t('landing.pricing.free.price'), desc: t('landing.pricing.free.desc'), features: [t('landing.feat.plan.free1'), t('landing.feat.plan.free2'), t('landing.feat.plan.free3')] },
                                        { name: t('landing.pricing.plus.name'), price: t('landing.pricing.plus.price'), desc: t('landing.pricing.plus.desc'), features: [t('landing.feat.plan.plus1'), t('landing.feat.plan.plus2'), t('landing.feat.plan.plus3'), t('landing.feat.plan.plus4')], popular: true },
                                        { name: t('landing.pricing.pro.name'), price: t('landing.pricing.pro.price'), desc: t('landing.pricing.pro.desc'), features: [t('landing.feat.plan.pro1'), t('landing.feat.plan.pro2'), t('landing.feat.plan.pro3'), t('landing.feat.plan.pro4')] },
                                    ].map((plan, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 20 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: i * 0.1 }}
                                            className={`relative glass-card p-8 flex flex-col ${plan.popular ? 'border-primary ring-1 ring-primary' : ''}`}
                                        >
                                            {plan.popular && (
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full">
                                                    {t('landing.pricing.popular')}
                                                </div>
                                            )}
                                            <div className="mb-8">
                                                <h4 className="text-lg font-bold mb-2">{plan.name}</h4>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl font-black">{plan.price}</span>
                                                    {plan.price !== t('landing.pricing.free.price') && plan.price !== 'Custom' && <span className="text-muted-foreground text-sm">{t('landing.pricing.mo')}</span>}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-2">{plan.desc}</p>
                                            </div>
                                            <ul className="space-y-4 mb-8 flex-1">
                                                {plan.features.map((f, j) => (
                                                    <li key={j} className="flex items-center gap-3 text-sm font-medium">
                                                        <div className="p-1 rounded-full bg-primary/10 text-primary">
                                                            <ShieldCheck className="h-3 w-3" />
                                                        </div>
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>
                                            <Button className={`w-full rounded-full h-12 font-bold ${plan.popular ? 'btn-premium' : 'glass hover:bg-muted'}`}>
                                                {plan.price === 'Custom' ? t('landing.pricing.contactSales') : t('landing.pricing.getStarted')}
                                            </Button>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </Reveal>

                    <Reveal width="100%">
                        <FAQSection />
                    </Reveal>

                    {/* CTA Final */}
                    <Reveal width="100%">
                        <section className="py-24 md:py-32 relative overflow-hidden">
                            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                            <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
                                <h2 className="text-4xl md:text-5xl font-bold mb-8">{t('landing.cta.title')}</h2>
                                <p className="text-lg text-muted-foreground mb-12">
                                    {t('landing.cta.subtitle')}
                                </p>
                                <div className="flex flex-wrap justify-center gap-6">
                                    <Link href="/login">
                                        <Button size="lg" className="h-16 px-12 rounded-full text-lg font-bold btn-premium">
                                            {t('landing.getStarted')}
                                        </Button>
                                    </Link>
                                    <Button size="lg" variant="outline" className="h-16 px-12 rounded-full text-lg font-bold glass">
                                        Talk to an expert
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </Reveal>
                </>
            )}
        </div>
    );
}
