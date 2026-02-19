"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  TrendingDown,
  Activity,
  Rocket,
  Zap,
  Users,
  ExternalLink,
  LayoutDashboard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Wifi,
  MousePointerClick,
  Eye,
  ShoppingCart,
  DollarSign,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fromBasicUnits, formatCurrencyByCode } from "@/lib/currency-utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

/* ─── types ─── */
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

interface ChartDay {
  date: string;
  spend: number;
  revenue: number;
  messages: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  purchases: number;
  cpc: number;
  ctr: number;
  cpm: number;
  cpr: number;
  roas: number;
}

interface StatsData {
  totalSpend: number;
  totalRevenue: number;
  totalMessages: number;
  totalRoas: number;
  avgCostPerMessage: number;
  activeCampaigns: number;
  chartData: ChartDay[];
  changes: Record<string, number>;
  extendedStats: {
    impressions: number;
    clicks: number;
    linkClicks: number;
    cpc: number;
    cpm: number;
    ctr: number;
    cpp: number;
    funnel: { viewContent: number; addToCart: number; purchase: number };
  };
}

type Range = "7" | "14" | "30";

/* ─── motion config ─── */
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

/* ─── helpers ─── */
function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/* ─── sub-components ─── */
function AccountStatusDot({ status }: { status: number | string }) {
  const s = typeof status === "string" ? parseInt(status) : status;
  if (s === 1) return <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-500/20" />;
  if (s === 2) return <span className="h-2 w-2 rounded-full bg-red-500 inline-block ring-2 ring-red-500/20" />;
  return <span className="h-2 w-2 rounded-full bg-amber-500 inline-block ring-2 ring-amber-500/20" />;
}

function SkeletonBox({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted/40 ${className}`} />;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  change,
  color,
  bg,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  change?: number;
  color: string;
  bg: string;
  loading?: boolean;
}) {
  const isUp = change !== undefined && change > 0;
  const isDown = change !== undefined && change < 0;
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.45, ease }}
      className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 transition-all hover:shadow-md hover:border-border"
    >
      <div className={`absolute -right-5 -top-5 h-20 w-20 rounded-full ${bg} opacity-30 blur-2xl`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          {change !== undefined && !loading && (
            <div className={`flex items-center gap-1 text-[11px] font-semibold ${isUp ? "text-emerald-500" : isDown ? "text-red-400" : "text-muted-foreground"}`}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
              {change !== 0 ? `${Math.abs(change).toFixed(1)}%` : "—"}
            </div>
          )}
        </div>
        {loading ? (
          <>
            <SkeletonBox className="h-7 w-28 mb-1" />
            <SkeletonBox className="h-3 w-20" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            {sub && <p className="mt-0.5 text-[10px] text-muted-foreground/70">{sub}</p>}
          </>
        )}
      </div>
    </motion.div>
  );
}

/* custom recharts tooltip */
function ChartTooltip({ active, payload, label, currency = "THB" }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; currency?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 p-3 shadow-xl backdrop-blur-sm text-xs">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold ml-auto pl-4">{typeof p.value === "number" && p.value > 100 ? formatCompact(p.value) : p.value?.toFixed?.(2) ?? p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── main page ─── */
export default function DashboardPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const { selectedAccounts } = useAdAccount();

  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<Range>("30");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  /* fetch ad account enriched data */
  useEffect(() => {
    async function fetchAccounts() {
      if (!session?.user || selectedAccounts.length === 0) { setLoadingAccounts(false); return; }
      try {
        const res = await fetch("/api/team/ad-accounts");
        if (!res.ok) { setLoadingAccounts(false); return; }
        const data = await res.json();
        const fbAccounts = data.accounts || [];
        const enriched: AdAccount[] = selectedAccounts.map((acc: any) => {
          const fb = fbAccounts.find((f: any) => {
            const fId = String(f.account_id || "").replace(/^act_/, "");
            const aId = String(acc.account_id || "").replace(/^act_/, "");
            return fId === aId;
          });
          const currency = fb?.currency || acc.currency || "USD";
          return {
            id: acc.id,
            name: fb?.name || acc.name || "-",
            account_id: acc.account_id,
            activeAds: fb?.ads?.summary?.total_count || 0,
            spendingCap: fb?.spend_cap != null ? fromBasicUnits(fb.spend_cap, currency) : null,
            spentAmount: fb?.amount_spent != null ? fromBasicUnits(fb.amount_spent, currency) : null,
            currency,
            status: fb?.account_status ?? 0,
          };
        });
        setAccounts(enriched);
      } catch { } finally { setLoadingAccounts(false); }
    }
    fetchAccounts();
  }, [session, selectedAccounts]);

  /* fetch dashboard stats for charts */
  const fetchStats = useCallback(async () => {
    if (!session?.user || selectedAccounts.length === 0) return;
    setLoadingStats(true);
    try {
      const ids = selectedAccounts.map((a: any) => a.account_id).join(",");
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (parseInt(range) - 1));
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const res = await fetch(`/api/dashboard/stats?adAccountId=${encodeURIComponent(ids)}&startDate=${fmt(start)}&endDate=${fmt(end)}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { } finally { setLoadingStats(false); }
  }, [session, selectedAccounts, range, refreshKey]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* derived */
  const currency = accounts[0]?.currency || "THB";
  const totalSpend = accounts.reduce((s, a) => s + (a.spentAmount || 0), 0);
  const totalActiveAds = accounts.reduce((s, a) => s + (a.activeAds || 0), 0);
  const activeCount = accounts.filter((a) => {
    const s = typeof a.status === "string" ? parseInt(a.status) : a.status;
    return s === 1;
  }).length;
  const topAccounts = [...accounts].sort((a, b) => (b.activeAds || 0) - (a.activeAds || 0)).slice(0, 6);

  /* greeting */
  const firstName = session?.user?.name?.split(" ")[0] || "";
  const hour = mounted ? new Date().getHours() : -1;
  const greeting = hour < 0 ? "Dashboard" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  /* chart data (trimmed to have nice labels) */
  const chartData = useMemo(() => {
    if (!stats?.chartData) return [];
    return stats.chartData.map((d) => ({ ...d, dateLabel: formatShortDate(d.date) }));
  }, [stats]);

  /* funnel data */
  const funnelData = useMemo(() => {
    if (!stats?.extendedStats?.funnel) return [];
    const f = stats.extendedStats.funnel;
    return [
      { name: "View Content", value: f.viewContent, color: "#3b82f6" },
      { name: "Add to Cart", value: f.addToCart, color: "#8b5cf6" },
      { name: "Purchase", value: f.purchase, color: "#10b981" },
    ];
  }, [stats]);

  /* quick links */
  const quickLinks = [
    { href: "/ads", icon: BarChart3, title: "Ads Manager", color: "text-sky-500", bg: "bg-sky-500/10" },
    { href: "/create", icon: Rocket, title: "Create Ad", color: "text-violet-500", bg: "bg-violet-500/10" },
    { href: "/inbox", icon: MessageCircle, title: "Inbox", color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { href: "/ads?tab=export", icon: FileSpreadsheet, title: "Export", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { href: "/tools", icon: Zap, title: "Tools", color: "text-amber-500", bg: "bg-amber-500/10" },
    { href: "/settings", icon: Users, title: "Settings", color: "text-pink-500", bg: "bg-pink-500/10" },
  ];

  const rangeOptions: { label: string; value: Range }[] = [
    { label: "7D", value: "7" },
    { label: "14D", value: "14" },
    { label: "30D", value: "30" },
  ];

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="w-full space-y-5">

      {/* ─── Header ─── */}
      <motion.div variants={fadeUp} transition={{ duration: 0.45, ease }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {greeting}{firstName ? `, ${firstName}` : ""} 👋
            </h1>
            <p className="text-xs text-muted-foreground">Overview of your ad performance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${range === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline" size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loadingStats}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/create">
            <Button size="sm" className="gap-1.5 text-xs h-8">
              <PlusCircle className="h-3.5 w-3.5" />
              Create Ad
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* ─── Stats Cards ─── */}
      <motion.div variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={DollarSign} label="Total Spend" color="text-primary" bg="bg-primary/10" loading={loadingStats}
          value={stats ? formatCurrencyByCode(stats.totalSpend, currency, { maximumFractionDigits: 0 }) : mounted ? formatCurrencyByCode(totalSpend, currency, { maximumFractionDigits: 0 }) : "—"}
          change={stats?.changes?.spend}
        />
        <StatCard
          icon={TrendingUp} label="Revenue" color="text-emerald-500" bg="bg-emerald-500/10" loading={loadingStats}
          value={stats ? formatCurrencyByCode(stats.totalRevenue, currency, { maximumFractionDigits: 0 }) : "—"}
          change={stats?.changes?.revenue}
          sub={stats && stats.totalRoas > 0 ? `ROAS ${stats.totalRoas.toFixed(2)}x` : undefined}
        />
        <StatCard
          icon={MessageCircle} label="Messages" color="text-cyan-500" bg="bg-cyan-500/10" loading={loadingStats}
          value={stats ? formatCompact(stats.totalMessages) : "—"}
          change={stats?.changes?.messages}
          sub={stats && stats.avgCostPerMessage > 0 ? `CPR ${formatCurrencyByCode(stats.avgCostPerMessage, currency, { maximumFractionDigits: 2 })}` : undefined}
        />
        <StatCard
          icon={Megaphone} label="Active Campaigns" color="text-violet-500" bg="bg-violet-500/10" loading={loadingStats}
          value={stats ? String(stats.activeCampaigns) : mounted ? String(totalActiveAds) : "—"}
        />
      </motion.div>

      {/* ─── Extended Metric Cards ─── */}
      <motion.div variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Eye} label="Impressions" color="text-blue-500" bg="bg-blue-500/10" loading={loadingStats}
          value={stats ? formatCompact(stats.extendedStats.impressions) : "—"}
        />
        <StatCard
          icon={MousePointerClick} label="Link Clicks" color="text-orange-500" bg="bg-orange-500/10" loading={loadingStats}
          value={stats ? formatCompact(stats.extendedStats.linkClicks) : "—"}
          change={stats?.changes?.cpc ? -stats.changes.cpc : undefined}
          sub={stats && stats.extendedStats.cpc > 0 ? `CPC ${formatCurrencyByCode(stats.extendedStats.cpc, currency, { maximumFractionDigits: 2 })}` : undefined}
        />
        <StatCard
          icon={BarChart3} label="CTR" color="text-pink-500" bg="bg-pink-500/10" loading={loadingStats}
          value={stats ? `${stats.extendedStats.ctr.toFixed(2)}%` : "—"}
          change={stats?.changes?.ctr}
        />
        <StatCard
          icon={Activity} label="CPM" color="text-amber-500" bg="bg-amber-500/10" loading={loadingStats}
          value={stats ? formatCurrencyByCode(stats.extendedStats.cpm, currency, { maximumFractionDigits: 2 }) : "—"}
          change={stats?.changes?.cpm ? -stats.changes.cpm : undefined}
        />
      </motion.div>

      {/* ─── Main Chart: Spend + Revenue ─── */}
      <motion.div variants={fadeUp} transition={{ duration: 0.5, ease }}
        className="rounded-xl border border-border/50 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary/70" />
            <h2 className="text-sm font-bold">Spend & Revenue</h2>
            <Badge variant="secondary" className="text-[10px] px-1.5">{range}D</Badge>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary inline-block" />Spend</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />Revenue</span>
          </div>
        </div>
        {loadingStats ? (
          <SkeletonBox className="h-52 w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={45} />
              <Tooltip content={<ChartTooltip currency={currency} />} />
              <Area type="monotone" dataKey="spend" name="Spend" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#spendGrad)" dot={false} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ─── 2-Column Charts: Impressions/Clicks + Messages/CPR ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Impressions & Link Clicks */}
        <motion.div variants={fadeUp} transition={{ duration: 0.5, ease }}
          className="rounded-xl border border-border/50 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-bold">Impressions & Link Clicks</h2>
          </div>
          {loadingStats ? (
            <SkeletonBox className="h-44 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={40} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={40} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Bar yAxisId="left" dataKey="impressions" name="Impressions" fill="#3b82f6" opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar yAxisId="right" dataKey="linkClicks" name="Link Clicks" fill="#f97316" opacity={0.8} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Messages & CTR */}
        <motion.div variants={fadeUp} transition={{ duration: 0.5, ease }}
          className="rounded-xl border border-border/50 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-cyan-500" />
            <h2 className="text-sm font-bold">Messages & CTR</h2>
          </div>
          {loadingStats ? (
            <SkeletonBox className="h-44 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={40} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} width={42} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Line yAxisId="left" type="monotone" dataKey="messages" name="Messages" stroke="#06b6d4" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="ctr" name="CTR %" stroke="#ec4899" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* ─── Bottom Row: Funnel + Accounts + Quick Actions ─── */}
      <div className="grid gap-4 lg:grid-cols-12">

        {/* Conversion Funnel */}
        <motion.div variants={fadeUp} transition={{ duration: 0.5, ease }}
          className="rounded-xl border border-border/50 bg-card p-5 lg:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-bold">Conversion Funnel</h2>
          </div>
          {loadingStats ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <SkeletonBox key={i} className="h-12 w-full" />)}
            </div>
          ) : funnelData.every((f) => f.value === 0) ? (
            <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">No conversion data</div>
          ) : (
            <div className="space-y-2.5 mt-1">
              {funnelData.map((item, i) => {
                const max = funnelData[0].value || 1;
                const pct = (item.value / max) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="text-muted-foreground font-medium">{item.name}</span>
                      <span className="font-bold tabular-nums">{formatCompact(item.value)}</span>
                    </div>
                    <div className="h-7 w-full rounded-lg bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700 flex items-center px-2"
                        style={{ width: `${pct}%`, background: item.color, minWidth: item.value > 0 ? "2rem" : 0, opacity: 0.85 }}
                      />
                    </div>
                    {i < funnelData.length - 1 && funnelData[i + 1].value > 0 && item.value > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 text-right">
                        {((funnelData[i + 1].value / item.value) * 100).toFixed(1)}% conversion
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Top Accounts Table */}
        <motion.div variants={fadeUp} transition={{ duration: 0.5, ease }}
          className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card lg:col-span-5">
          <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary/70" />
              <h2 className="text-sm font-bold">Ad Accounts</h2>
            </div>
            <Link href="/ads?tab=accounts" className="flex items-center gap-1 text-[11px] font-medium text-primary hover:opacity-80">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loadingAccounts ? (
            <div className="space-y-0 divide-y divide-border/10">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted/40 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-muted/40" />
                    <div className="h-2.5 w-20 rounded bg-muted/30" />
                  </div>
                  <div className="h-3 w-16 rounded bg-muted/30" />
                </div>
              ))}
            </div>
          ) : topAccounts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="rounded-xl bg-muted/30 p-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No accounts connected</p>
              <Link href="/settings">
                <Button variant="outline" size="sm" className="text-xs">Connect Account</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-2 border-b border-border/20 bg-muted/5 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-7">Account</div>
                <div className="col-span-2 text-center">Ads</div>
                <div className="col-span-3 text-right">Spend</div>
              </div>
              <div className="flex-1 overflow-auto">
                {topAccounts.map((acc) => (
                  <div key={acc.id} className="group grid grid-cols-12 items-center gap-2 border-b border-border/10 px-5 py-3 transition-colors last:border-0 hover:bg-muted/10">
                    <div className="col-span-7 flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                        {acc.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-semibold">{acc.name}</p>
                          <a href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${acc.account_id}`} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                          </a>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <AccountStatusDot status={acc.status} />
                          <p className="font-mono text-[9px] text-muted-foreground truncate">{acc.account_id}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">{acc.activeAds}</Badge>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="text-xs font-bold">
                        {acc.spentAmount != null ? formatCurrencyByCode(acc.spentAmount, acc.currency, { maximumFractionDigits: 0 }) : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={fadeUp} transition={{ duration: 0.5, ease }} className="lg:col-span-4">
          <h2 className="px-0.5 text-sm font-bold mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-2">
            {quickLinks.map((item, i) => (
              <Link key={i} href={item.href} className="group">
                <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card p-3 transition-all hover:border-primary/20 hover:shadow-sm">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold truncate">{item.title}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* ROAS Summary */}
          {stats && (
            <div className="mt-3 rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <h3 className="text-xs font-bold">Performance Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "ROAS", value: stats.totalRoas > 0 ? `${stats.totalRoas.toFixed(2)}x` : "—", up: (stats.changes?.roas || 0) > 0 },
                  { label: "CPR", value: stats.avgCostPerMessage > 0 ? formatCurrencyByCode(stats.avgCostPerMessage, currency, { maximumFractionDigits: 2 }) : "—", up: (stats.changes?.messages || 0) > 0 },
                  { label: "CPC", value: stats.extendedStats.cpc > 0 ? formatCurrencyByCode(stats.extendedStats.cpc, currency, { maximumFractionDigits: 2 }) : "—", up: false },
                  { label: "Purchases", value: stats.extendedStats.funnel.purchase > 0 ? formatCompact(stats.extendedStats.funnel.purchase) : "—", up: (stats.changes?.purchases || 0) > 0 },
                ].map((m, i) => (
                  <div key={i} className="rounded-lg bg-muted/30 p-2.5">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{m.label}</p>
                    <p className="text-sm font-bold tabular-nums">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
