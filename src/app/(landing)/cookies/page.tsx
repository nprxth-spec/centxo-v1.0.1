"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Cookie, ShieldCheck, Eye, Scale } from "lucide-react";

export default function CookiesPage() {
    const { t } = useLanguage();

    const sections = [
        {
            icon: Eye,
            title: 'How we use Cookies',
            content: 'We use cookies to understand how you interact with our site, save your preferences, and provide a personalized experience. Some cookies are necessary for the site to function, while others help us improve performance.'
        },
        {
            icon: ShieldCheck,
            title: 'Security',
            content: 'Cookies help us identify and prevent security risks. We use them to authenticate users and protect user data from unauthorized parties.'
        },
        {
            icon: Scale,
            title: 'Your Choices',
            content: 'You can choose to accept or decline cookies. Most web browsers automatically accept them, but you can usually modify your browser setting to decline cookies if you prefer.'
        }
    ];

    return (
        <div className="relative min-h-screen bg-background selection:bg-primary/30 selection:text-foreground">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto mb-20"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">
                            {t('landing.cookies.title')}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            {t('landing.cookies.subtitle')}
                        </p>
                    </motion.div>

                    <div className="max-w-4xl mx-auto space-y-12">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="glass-card p-12"
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                    <Cookie className="h-6 w-6" />
                                </div>
                                <h2 className="text-2xl font-bold">Introduction</h2>
                            </div>
                            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                                {t('landing.cookies.desc')}
                            </p>
                            <div className="space-y-12">
                                {sections.map((section, i) => (
                                    <div key={i} className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <section.icon className="h-5 w-5 text-primary" />
                                            <h3 className="text-xl font-bold">{section.title}</h3>
                                        </div>
                                        <p className="text-muted-foreground leading-relaxed">
                                            {section.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <div className="text-center text-sm text-muted-foreground">
                            Last Updated: February 19, 2026
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
