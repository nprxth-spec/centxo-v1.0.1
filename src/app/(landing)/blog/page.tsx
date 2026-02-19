"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, User, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function BlogPage() {
    const { t } = useLanguage();

    const posts = [
        {
            title: 'How AI is Changing Facebook Ads in 2026',
            excerpt: 'The landscape of digital advertising is evolving rapidly. Learn how AI-driven workflows are providing a competitive edge.',
            date: 'Feb 15, 2026',
            author: 'Centxo Team',
            category: 'AI & Automation'
        },
        {
            title: 'Scaling Your Ad Accounts Without Increasing Headcount',
            excerpt: 'Automation is the key to scaling. We explore the tools and strategies that allow small teams to manage massive budgets.',
            date: 'Feb 10, 2026',
            author: 'Sarah Johnson',
            category: 'Strategy'
        },
        {
            title: 'Understanding ROAS in the Era of Privacy',
            excerpt: 'With tracking becoming more difficult, how do you measure success? We look at the new metrics that matter.',
            date: 'Feb 5, 2026',
            author: 'Marketing Science',
            category: 'Insights'
        }
    ];

    return (
        <div className="relative min-h-screen bg-background selection:bg-primary/30 selection:text-foreground">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto mb-20"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">
                            {t('landing.blog.title')}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            {t('landing.blog.subtitle')}
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post, i) => (
                            <motion.article
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-card overflow-hidden group hover:border-primary/50 transition-all duration-300 flex flex-col"
                            >
                                <div className="aspect-video bg-muted/50 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-violet-500/10" />
                                    <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-background/80 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-primary">
                                        {post.category}
                                    </div>
                                </div>
                                <div className="p-8 flex-1 flex flex-col">
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {post.date}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {post.author}
                                        </div>
                                    </div>
                                    <h2 className="text-xl font-bold mb-4 group-hover:text-primary transition-colors">
                                        {post.title}
                                    </h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-6 line-clamp-3">
                                        {post.excerpt}
                                    </p>
                                    <div className="mt-auto pt-6 border-t border-border/40">
                                        <Link href="#" className="inline-flex items-center text-sm font-bold text-primary group-hover:translate-x-1 transition-transform">
                                            Read article <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </div>
                                </div>
                            </motion.article>
                        ))}
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        className="mt-20 text-center"
                    >
                        <p className="text-muted-foreground mb-8">Want to stay updated with our latest insights?</p>
                        <Link href="/login">
                            <button className="px-8 py-4 rounded-full bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20">
                                Subscribe to Newsletter
                            </button>
                        </Link>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
