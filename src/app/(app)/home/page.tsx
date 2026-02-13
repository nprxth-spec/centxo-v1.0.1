"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSystemStats } from "@/app/actions/get-system-stats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Users, 
  Layers, 
  Megaphone, 
  PlusCircle,
  ArrowRight,
  MessageCircle,
  TrendingUp,
  BarChart3,
  FileSpreadsheet
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SystemStats {
  users: number;
  adAccounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  teamMembers: number;
}

export default function HomePage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getSystemStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <h1 className="text-page-title">
            {t('home.welcome', 'Welcome back')}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm md:text-base">
            {t('home.subtitle', 'Here\'s what\'s happening with your ads')}
          </p>
        </div>
        <Link href="/create">
          <Button size="lg" className="gap-2">
            <PlusCircle className="h-5 w-5" />
            {t('home.createAd', 'Create Ad')}
          </Button>
        </Link>
      </div>

      {/* Quick Stats Grid - minimal glass cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl md:text-3xl font-bold tabular-nums">{stats?.adAccounts?.toLocaleString() ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('home.stats.accounts', 'Ad Accounts')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl md:text-3xl font-bold tabular-nums">{stats?.campaigns?.toLocaleString() ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('home.stats.campaigns', 'Campaigns')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl md:text-3xl font-bold tabular-nums">{stats?.ads?.toLocaleString() ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('home.stats.ads', 'Active Ads')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl md:text-3xl font-bold tabular-nums">{stats?.teamMembers?.toLocaleString() ?? 0}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('home.stats.team', 'Team Members')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Manage Ads Card */}
        <Link href="/ads" className="group">
          <Card className="glass-card h-full transition-all hover:shadow-sm hover:border-primary/20 cursor-pointer">
            <CardHeader className="p-5 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                  <Megaphone className="h-6 w-6 text-primary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
              </div>
              <CardTitle className="mt-4 text-base">{t('home.actions.manageAds', 'Manage Ads')}</CardTitle>
              <CardDescription className="mt-1.5 text-sm leading-relaxed">
                {t('home.actions.manageAdsDesc', 'View and manage your campaigns, ad sets, and ads')}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {/* Inbox Card */}
        <Link href="/inbox" className="group">
          <Card className="glass-card h-full transition-all hover:shadow-sm hover:border-primary/20 cursor-pointer">
            <CardHeader className="p-5 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
              </div>
              <CardTitle className="mt-4 text-base">{t('home.actions.inbox', 'Inbox')}</CardTitle>
              <CardDescription className="mt-1.5 text-sm leading-relaxed">
                {t('home.actions.inboxDesc', 'Reply to messages from your Facebook pages')}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {/* Export Card */}
        <Link href="/ads?tab=export" className="group">
          <Card className="glass-card h-full transition-all hover:shadow-sm hover:border-primary/20 cursor-pointer">
            <CardHeader className="p-5 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
              </div>
              <CardTitle className="mt-4 text-base">{t('home.actions.export', 'Export Data')}</CardTitle>
              <CardDescription className="mt-1.5 text-sm leading-relaxed">
                {t('home.actions.exportDesc', 'Export your ad data to Google Sheets')}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
