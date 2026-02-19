"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAdAccount } from "@/contexts/AdAccountContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import {
  Layers,
  Megaphone,
  PlusCircle,
  ArrowRight,
  MessageCircle,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  Activity,
  Rocket,
  Zap,
  Users,
  ExternalLink,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fromBasicUnits, formatCurrencyByCode } from "@/lib/currency-utils";

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  activeAds: number;
  spendingCap: number | null;
  spentAmount: number | null;
  currency: string;
  status: number | string;
}

function StatCard({
  icon: Icon,
  value,
  label,
  color = "text-primary",
  delay = 0,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card p-5 flex items-center gap-4"
    >
      <div className={`p-2.5 rounded-xl bg-muted/50 shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
      </div>
    </motion.div>
  );
}

function AccountStatusDot({ status }: { status: number | string }) {
  const s = typeof status === "string" ? parseInt(status) : status;
  if (s === 1) return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />;
  if (s === 2) return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />;
}

export default function HomePage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const { selectedAccounts } = useAdAccount();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchAccounts() {
      if (!session?.user || selectedAccounts.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/team/ad-accounts");
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const fbAccounts = data.accounts || [];
        const enriched: AdAccount[] = selectedAccounts.map((acc: any) => {
          const fb = fbAccounts.find((f: any) => {
            const fId = String(f.account_id || "").replace(/^act_/, "");
            const aId = String(acc.account_id || "").replace(/^act_/, "");
            return fId === aId;
          });
          const currency = fb?.currency || acc.currency || "USD";
          const spendingCap = fb?.spend_cap != null ? fromBasicUnits(fb.spend_cap, currency) : null;
          const spentAmount = fb?.amount_spent != null ? fromBasicUnits(fb.amount_spent, currency) : null;
          return {
            id: acc.id,
            name: fb?.name || acc.name || "-",
            account_id: acc.account_id,
            activeAds: fb?.ads?.summary?.total_count || 0,
            spendingCap,
            spentAmount,
            currency,
            status: fb?.account_status ?? 0,
          };
        });
        setAccounts(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, [session, selectedAccounts]);

  // Aggregated totals
  const totalSpend = accounts.reduce((s, a) => s + (a.spentAmount || 0), 0);
  const totalActiveAds = accounts.reduce((s, a) => s + (a.activeAds || 0), 0);
  const primaryCurrency = accounts[0]?.currency || "THB";

  // Sort by active ads desc for "top accounts"
  const topAccounts = [...accounts].sort((a, b) => (b.activeAds || 0) - (a.activeAds || 0)).slice(0, 5);

  const quickLinks = [
    {
      href: "/ads-manager",
      icon: BarChart3,
      title: t("home.actions.adsManager", "Ads Manager"),
      desc: t("home.actions.adsManagerDesc", "View campaigns, ad sets, and performance in real-time."),
      color: "text-sky-500",
      bg: "bg-sky-500/10",
    },
    {
      href: "/create",
      icon: Rocket,
      title: t("home.actions.createAd", "Create Ad (Auto)"),
      desc: t("home.actions.createAdDesc", "Launch a campaign in 60 seconds with AI assistance."),
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      href: "/inbox",
      icon: MessageCircle,
      title: t("home.actions.inbox", "Inbox"),
      desc: t("home.actions.inboxDesc", "Reply to messages from your Facebook Pages."),
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      href: "/ads-manager?tab=export",
      icon: FileSpreadsheet,
      title: t("home.actions.export", "Export to Sheets"),
      desc: t("home.actions.exportDesc", "Automatically export ad data to Google Sheets."),
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      href: "/tools",
      icon: Zap,
      title: t("home.actions.tools", "Tools"),
      desc: t("home.actions.toolsDesc", "Automation rules, creative labs, and AI tools."),
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      href: "/settings",
      icon: Users,
      title: t("home.actions.team", "Team & Accounts"),
      desc: t("home.actions.teamDesc", "Manage team members and connected ad accounts."),
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("home.subtitle", "Your account overview")}
            </p>
          </div>
        </div>
        <Link href="/create">
          <Button size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {t("home.createAd", "Create Ad")}
          </Button>
        </Link>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Layers}
          value={mounted ? selectedAccounts.length : "—"}
          label={t("home.stats.accounts", "Ad Accounts")}
          color="text-primary"
          delay={0}
        />
        <StatCard
          icon={Activity}
          value={mounted ? totalActiveAds : "—"}
          label={t("home.stats.ads", "Active Ads")}
          color="text-emerald-500"
          delay={0.05}
        />
        <StatCard
          icon={Megaphone}
          value={mounted && selectedAccounts.length > 0 && !loading
            ? formatCurrencyByCode(totalSpend, primaryCurrency, { maximumFractionDigits: 0 })
            : "—"}
          label={t("home.stats.totalSpend", "Total Spend")}
          color="text-violet-500"
          delay={0.1}
        />
        <StatCard
          icon={TrendingUp}
          value={mounted ? accounts.filter(a => {
            const s = typeof a.status === "string" ? parseInt(a.status) : a.status;
            return s === 1;
          }).length : "—"}
          label={t("home.stats.activeAccounts", "Active Accounts")}
          color="text-sky-500"
          delay={0.15}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Top Accounts Table */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-3 glass-card p-0 overflow-hidden flex flex-col"
        >
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <h2 className="text-sm font-bold">{t("home.topAccounts", "Ad Accounts")}</h2>
            <Link href="/ads-manager" className="text-[11px] text-primary hover:opacity-80 transition-opacity flex items-center gap-1">
              {t("home.viewAll", "View all")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-muted/50 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted/50 rounded w-40" />
                    <div className="h-2.5 bg-muted/30 rounded w-24" />
                  </div>
                  <div className="h-3 bg-muted/30 rounded w-16" />
                </div>
              ))}
            </div>
          ) : topAccounts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-3">
              <div className="p-3 rounded-xl bg-muted/30">
                <Layers className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("home.noAccounts", "No ad accounts connected yet.")}
              </p>
              <Link href="/settings">
                <Button variant="outline" size="sm">{t("home.connectAccount", "Connect Account")}</Button>
              </Link>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-border/20 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/5">
                <div className="col-span-6">Account</div>
                <div className="col-span-2 text-center">Ads</div>
                <div className="col-span-4 text-right">Spend</div>
              </div>
              {topAccounts.map((acc, i) => (
                <div
                  key={acc.id}
                  className="grid grid-cols-12 gap-2 px-5 py-3.5 border-b border-border/10 items-center group hover:bg-muted/10 transition-colors last:border-0"
                >
                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                      {acc.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold truncate">{acc.name}</p>
                        <a
                          href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${acc.account_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <AccountStatusDot status={acc.status} />
                        <p className="text-[10px] text-muted-foreground font-mono">{acc.account_id}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-center">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-bold">
                      {acc.activeAds}
                    </Badge>
                  </div>
                  <div className="col-span-4 text-right">
                    <p className="text-xs font-bold">
                      {acc.spentAmount != null
                        ? formatCurrencyByCode(acc.spentAmount, acc.currency, { maximumFractionDigits: 0 })
                        : "—"}
                    </p>
                    {acc.spendingCap && acc.spendingCap > 0 && (
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        / {formatCurrencyByCode(acc.spendingCap, acc.currency, { maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-2 flex flex-col gap-3"
        >
          <h2 className="text-sm font-bold px-1">{t("home.quickActions", "Quick Actions")}</h2>
          {quickLinks.map((item, i) => (
            <Link key={i} href={item.href} className="group">
              <div className="glass-card p-4 flex items-center gap-3 hover:border-primary/20 transition-all hover:shadow-sm cursor-pointer">
                <div className={`p-2 rounded-xl ${item.bg} ${item.color} shrink-0`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-tight">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{item.desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
