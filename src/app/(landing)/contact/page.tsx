"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Mail, MessageSquare, Globe, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
    const { t } = useLanguage();

    return (
        <div className="relative min-h-screen bg-background selection:bg-primary/30 selection:text-foreground">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px]" />
            </div>

            <main className="relative z-10 pt-32 pb-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto mb-20"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8">
                            {t('landing.contact.title')}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            {t('landing.contact.subtitle')}
                        </p>
                    </motion.div>

                    <div className="grid lg:grid-cols-2 gap-16 items-start">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="space-y-12"
                        >
                            <div>
                                <h2 className="text-2xl font-bold mb-6">Get in Touch</h2>
                                <p className="text-muted-foreground mb-8 text-lg">
                                    Have a question about our features, pricing, or anything else? Our team is ready to answer all your questions.
                                </p>
                            </div>

                            <div className="space-y-8">
                                <div className="flex gap-6">
                                    <div className="p-4 rounded-2xl bg-primary/10 text-primary h-fit">
                                        <Mail className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1 text-lg">Email Us</h4>
                                        <p className="text-muted-foreground mb-2">For general inquiries and support.</p>
                                        <a href="mailto:support@centxo.online" className="text-primary font-bold hover:underline text-lg">support@centxo.online</a>
                                    </div>
                                </div>

                                <div className="flex gap-6">
                                    <div className="p-4 rounded-2xl bg-violet-500/10 text-violet-500 h-fit">
                                        <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1 text-lg">Live Chat</h4>
                                        <p className="text-muted-foreground mb-2">Available Mon-Fri, 9am - 6pm (GMT+7).</p>
                                        <button className="text-violet-500 font-bold hover:underline text-lg">Start a conversation</button>
                                    </div>
                                </div>

                                <div className="flex gap-6">
                                    <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 h-fit">
                                        <Globe className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1 text-lg">Knowledge Base</h4>
                                        <p className="text-muted-foreground mb-2">Find answers in our documentation.</p>
                                        <button className="text-emerald-500 font-bold hover:underline text-lg">Visit Help Center</button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="glass-card p-8 md:p-12 shadow-2xl shadow-primary/5"
                        >
                            <form className="space-y-6">
                                <div className="grid sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold ml-1">First Name</label>
                                        <Input placeholder="John" className="h-12 rounded-xl glass focus:ring-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold ml-1">Last Name</label>
                                        <Input placeholder="Doe" className="h-12 rounded-xl glass focus:ring-primary" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold ml-1">Email Address</label>
                                    <Input type="email" placeholder="john@example.com" className="h-12 rounded-xl glass focus:ring-primary" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold ml-1">Subject</label>
                                    <Input placeholder="How can we help?" className="h-12 rounded-xl glass focus:ring-primary" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold ml-1">Message</label>
                                    <Textarea placeholder="Tell us more about your inquiry..." className="min-h-[150px] rounded-xl glass focus:ring-primary resize-none" />
                                </div>
                                <Button className="w-full h-14 rounded-full text-lg font-bold btn-premium">
                                    Send Message <Send className="ml-2 h-5 w-5" />
                                </Button>
                            </form>
                        </motion.div>
                    </div>
                </div>
            </main>
        </div>
    );
}
