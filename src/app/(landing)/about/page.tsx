"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users2, Target, Zap, Rocket } from "lucide-react";

export default function AboutPage() {
    const { t } = useLanguage();

    const values = [
        { icon: Target, title: 'Mission', key: 'mission' },
        { icon: Zap, title: 'Speed', key: 'speed' },
        { icon: Users2, title: 'Focus', key: 'focus' },
        { icon: Rocket, title: 'Scalability', key: 'scalability' },
    ];

    return (
        <div className="relative min-h-screen bg-background selection:bg-primary/30 selection:text-foreground">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto mb-20"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">
                            {t('landing.about.title')}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            {t('landing.about.subtitle')}
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-16 items-center mb-32">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="glass-card p-8 md:p-12"
                        >
                            <h2 className="text-3xl font-bold mb-6">Our Vision</h2>
                            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                                {t('landing.about.desc')}
                            </p>
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                We believe that AI shouldn't replace humans, but empower them to do more. By automating the heavy lifting of data analysis and campaign management, we enable businesses of all sizes to compete on a global scale.
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="relative aspect-square rounded-3xl overflow-hidden glass-card flex items-center justify-center"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-violet-500/10" />
                            <Users2 className="w-32 h-32 text-primary/20" />
                        </motion.div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {values.map((v, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-card p-8 text-center"
                            >
                                <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-6">
                                    <v.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{v.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Dedicated to providing world-class {v.title.toLowerCase()} for our users around the globe.
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
