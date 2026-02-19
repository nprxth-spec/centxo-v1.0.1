"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { MapPin, Briefcase, Clock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CareersPage() {
    const { t } = useLanguage();

    const jobs = [
        {
            title: 'Senior Frontend Engineer',
            team: 'Product',
            type: 'Full-time',
            location: 'Remote (Anywhere)'
        },
        {
            title: 'AI/ML Engineer',
            team: 'Core Engine',
            type: 'Full-time',
            location: 'Remote (Anywhere)'
        },
        {
            title: 'Product Marketing Manager',
            team: 'Growth',
            type: 'Full-time',
            location: 'Remote (Anywhere)'
        },
        {
            title: 'Customer Success Specialist',
            team: 'Operations',
            type: 'Full-time',
            location: 'Remote (THA/SEA)'
        }
    ];

    const benefits = [
        { icon: Globe, title: 'Remote-First', desc: 'Work from anywhere in the world.' },
        { icon: Clock, title: 'Flexible Hours', desc: 'Set your own schedule for peak productivity.' },
        { icon: Briefcase, title: 'Work Equipment', desc: 'We provide the latest tech tools you need.' },
        { icon: Globe, title: 'Global Retreats', desc: 'Annual meetups in beautiful locations.' },
    ];

    return (
        <div className="relative min-h-screen bg-background selection:bg-primary/30 selection:text-foreground">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto mb-20"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">
                            {t('landing.careers.title')}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            {t('landing.careers.subtitle')}
                        </p>
                    </motion.div>

                    <div className="mb-32">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold mb-4">Why Work with Us?</h2>
                            <p className="text-muted-foreground">Building the future of marketing AI requires a great team.</p>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {benefits.map((b, i) => (
                                <div key={i} className="glass-card p-8 text-center">
                                    <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-6">
                                        <b.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2">{b.title}</h3>
                                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold mb-4">Open Positions</h2>
                            <p className="text-muted-foreground">Come help us build something amazing.</p>
                        </div>
                        <div className="space-y-4">
                            {jobs.map((job, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-primary/50 transition-colors"
                                >
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">{job.title}</h3>
                                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Briefcase className="h-4 w-4" />
                                                {job.team}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-4 w-4" />
                                                {job.type}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-4 w-4" />
                                                {job.location}
                                            </div>
                                        </div>
                                    </div>
                                    <Button className="rounded-full px-8">Apply Now</Button>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-16 text-center p-12 rounded-3xl bg-primary/5 border border-primary/20">
                            <h3 className="text-2xl font-bold mb-4">Don't see a perfect fit?</h3>
                            <p className="text-muted-foreground mb-8">We are always looking for exceptional talent. Drop us a line.</p>
                            <Button variant="outline" className="rounded-full px-8 glass">Send Spontaneous Application</Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
