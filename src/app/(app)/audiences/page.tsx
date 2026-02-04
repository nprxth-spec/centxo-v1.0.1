'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdAccount } from '@/contexts/AdAccountContext';
import {
  Users, Loader2, Plus, Check, ChevronsUpDown, Search, Shield, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CustomAudience {
  id: string;
  name: string;
  subtype?: string;
  approximate_count?: number;
  time_created?: string;
}

export default function AudiencesPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const {
    selectedAccounts,
    adAccounts: allAdAccounts,
    selectedPages,
    pages: allPages,
    loading: accountsLoading,
  } = useAdAccount();

  // Use ONLY selected accounts/pages from Settings > Connections > Ad Accounts tab
  const adAccounts = selectedAccounts ?? [];
  const pages = selectedPages ?? [];

  const [adAccountId, setAdAccountId] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('audiences_adAccountId') || '';
      } catch { return ''; }
    }
    return '';
  });
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [audienceName, setAudienceName] = useState('');
  const [retentionDays, setRetentionDays] = useState(365);
  const [audiences, setAudiences] = useState<CustomAudience[]>([]);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [audiencesError, setAudiencesError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pageSearch, setPageSearch] = useState('');
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [pagePopoverOpen, setPagePopoverOpen] = useState(false);

  const hasAccounts = adAccounts.length > 0;
  const hasPages = pages.length > 0;

  // Show loading while fetching accounts/pages
  if (accountsLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Persist adAccountId to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && adAccountId) {
      try {
        localStorage.setItem('audiences_adAccountId', adAccountId);
      } catch { /* ignore */ }
    }
  }, [adAccountId]);

  // Auto-select first account when adAccounts load and none selected (or restored ID not in list)
  useEffect(() => {
    if (adAccounts.length === 0) return;
    const norm = (id: string) => String(id || '').replace(/^act_/, '');
    const validId = adAccounts.some((a: any) => norm(a.account_id) === norm(adAccountId));
    if (!validId) {
      const first = adAccounts[0];
      if (first?.account_id) setAdAccountId(first.account_id);
    }
  }, [adAccounts]);

  const getCachedAudiences = useCallback((cacheKey: string): CustomAudience[] => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((a: any) => a?.id) : [];
    } catch {
      return [];
    }
  }, []);

  const getCacheKey = useCallback((actId: string) => {
    const norm = actId.replace(/^act_/, '');
    return `audiences_cache_act_${norm}`;
  }, []);

  useEffect(() => {
    if (adAccountId) {
      setLoadingAudiences(true);
      setAudiencesError(null);
      const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const cacheKey = getCacheKey(actId);
      fetch(`/api/facebook/custom-audiences?adAccountId=${encodeURIComponent(actId)}`, { cache: 'no-store' })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok || d.error) {
            setAudiencesError(d.error || `HTTP ${r.status}`);
            setAudiences(getCachedAudiences(cacheKey));
          } else {
            setAudiencesError(null);
            const list = d.audiences || [];
            const cached = getCachedAudiences(cacheKey);
            const apiIds = new Set((list || []).map((a: any) => a?.id).filter(Boolean));
            const fromCache = (cached || []).filter((a: any) => a?.id && !apiIds.has(a.id));
            const merged = [...(list || []), ...fromCache];
            setAudiences(merged);
            if (merged.length > 0) {
              try {
                localStorage.setItem(cacheKey, JSON.stringify(merged));
              } catch { /* ignore */ }
            }
          }
        })
        .catch((err) => {
          setAudiencesError(err?.message || 'Failed to load audiences');
          const cached = getCachedAudiences(cacheKey);
          setAudiences(cached);
        })
        .finally(() => setLoadingAudiences(false));
    } else {
      setAudiences([]);
      setAudiencesError(null);
    }
  }, [adAccountId, getCacheKey, getCachedAudiences]);

  const refreshAudiences = useCallback(() => {
    if (!adAccountId) return;
    setLoadingAudiences(true);
    setAudiencesError(null);
    const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const cacheKey = getCacheKey(actId);
    fetch(`/api/facebook/custom-audiences?adAccountId=${encodeURIComponent(actId)}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.error) {
          setAudiencesError(d.error || `HTTP ${r.status}`);
          setAudiences(getCachedAudiences(cacheKey));
        } else {
          setAudiencesError(null);
          const list = d.audiences || [];
          const cached = getCachedAudiences(cacheKey);
          const apiIds = new Set((list || []).map((a: any) => a?.id).filter(Boolean));
          const fromCache = (cached || []).filter((a: any) => a?.id && !apiIds.has(a.id));
          const merged = [...(list || []), ...fromCache];
          setAudiences(merged);
          if (merged.length > 0) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(merged));
            } catch { /* ignore */ }
          }
        }
      })
      .catch((err) => {
        setAudiencesError(err?.message || 'Failed to load audiences');
        setAudiences(getCachedAudiences(cacheKey));
      })
      .finally(() => setLoadingAudiences(false));
  }, [adAccountId, getCacheKey, getCachedAudiences]);

  const togglePage = (pageId: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const handleCreate = async () => {
    if (!adAccountId || selectedPageIds.length === 0) {
      toast({ title: t('audiences.error.selectPages', 'กรุณาเลือก Ad Account และอย่างน้อย 1 เพจ'), variant: 'destructive' });
      return;
    }
    const name = audienceName.trim() || t('audiences.defaultName', 'คนที่ทักแล้ว - ไม่ให้เห็นแอด');
    setCreating(true);
    try {
      const res = await fetch('/api/facebook/custom-audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId: adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`,
          name,
          pageIds: selectedPageIds,
          retentionDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: t('audiences.created', 'สร้างกลุ่มเป้าหมายสำเร็จ'), variant: 'default' });
      const newAudience: CustomAudience = { id: data.id, name: data.audience?.name || name, subtype: 'ENGAGEMENT' };
      setAudiences((prev) => [newAudience, ...prev]);
      try {
        const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const cacheKey = `audiences_cache_act_${actId.replace(/^act_/, '')}`;
        const cached = getCachedAudiences(cacheKey);
        localStorage.setItem(cacheKey, JSON.stringify([newAudience, ...cached]));
      } catch { /* ignore */ }
      setAudienceName('');
      setSelectedPageIds([]);
    } catch (e: any) {
      toast({ title: e.message || 'Failed', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const filteredPages = pages.filter(
    (p: any) =>
      !pageSearch ||
      (p.name || '').toLowerCase().includes(pageSearch.toLowerCase()) ||
      (p.id || '').includes(pageSearch)
  );

  if (!hasAccounts || !hasPages) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-500" />
            {t('audiences.title', 'กลุ่มเป้าหมาย (Custom Audiences)')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('audiences.subtitle', 'สร้างกลุ่มคนที่ทักแชทแล้ว เพื่อไม่ให้เห็นโฆษณาซ้ำหลายเพจ')}
          </p>
        </div>
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Users className="h-12 w-12 text-amber-600" />
              <div>
                <h3 className="font-semibold">{t('audiences.selectFromSettingsFirst', 'กรุณาเลือก Ad Account และเพจก่อน')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('audiences.selectFromSettingsDesc', 'Ad Account และ Pages มาจากการเลือกใน Settings > Connections > Ad Accounts')}
                </p>
              </div>
              <Button asChild>
                <Link href="/settings/connections?tab=ad-accounts">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('audiences.goToSettings', 'ไปที่ Settings > Connections > Ad Accounts')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-indigo-500" />
          {t('audiences.title', 'กลุ่มเป้าหมาย (Custom Audiences)')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('audiences.subtitle', 'สร้างกลุ่มคนที่ทักแชทแล้ว เพื่อไม่ให้เห็นโฆษณาซ้ำหลายเพจ')}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Create Suppression Audience */}
        <Card>
          <CardHeader>
            <CardTitle>{t('audiences.createTitle', 'สร้างกลุ่ม Suppression (คนที่ทักแล้ว)')}</CardTitle>
            <CardDescription>
              {t('audiences.createDesc', 'เลือกเพจทั้งหมดที่ใช้ยิงแอด (รวมเพจชื่อเดียวกัน) — กลุ่มนี้จะรวมคนที่ทักมาทุกเพจ')}
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-2">
              <Link
                href="/settings/connections?tab=ad-accounts"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t('audiences.selectFromSettings', 'Ad Account และ Pages มาจากการเลือกใน Settings > Connections > Ad Accounts')}
              </Link>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('audiences.adAccount', 'Ad Account')}</Label>
              <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {adAccountId ? (
                      adAccounts.find((a: any) => a.account_id === adAccountId)?.name || adAccountId
                    ) : (
                      <span className="text-muted-foreground">{t('audiences.selectAccount', 'เลือกบัญชี')}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="max-h-[280px] overflow-y-auto overflow-x-hidden overscroll-contain" style={{ scrollBehavior: 'smooth' }}>
                    <div className="p-1">
                      {adAccounts.map((a: any) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setAdAccountId(a.account_id);
                            setAccountPopoverOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent',
                            adAccountId === a.account_id && 'bg-accent'
                          )}
                        >
                          <span className="truncate">{a.name}</span>
                          {adAccountId === a.account_id && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{t('audiences.pages', 'เพจที่รวมในกลุ่ม (เลือกหลายเพจได้)')}</Label>
              <Popover open={pagePopoverOpen} onOpenChange={setPagePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {selectedPageIds.length > 0 ? (
                      <span>{selectedPageIds.length} {t('audiences.pagesSelected', 'เพจที่เลือก')}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('audiences.selectPages', 'เลือกเพจ')}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="border-b px-3">
                    <Search className="inline h-4 w-4 text-muted-foreground mr-2" />
                    <input
                      placeholder={t('audiences.searchPages', 'ค้นหาเพจ...')}
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      className="flex h-10 w-full bg-transparent py-3 text-sm outline-none"
                    />
                  </div>
                  <div className="max-h-[280px] overflow-y-auto overflow-x-hidden overscroll-contain" style={{ scrollBehavior: 'smooth' }}>
                    <div className="p-1">
                      {filteredPages.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePage(p.id)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent',
                            selectedPageIds.includes(p.id) && 'bg-accent'
                          )}
                        >
                          <span className="truncate">{p.name}</span>
                          {selectedPageIds.includes(p.id) && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('audiences.audienceName', 'ชื่อกลุ่ม')}</Label>
                <Input
                  placeholder={t('audiences.defaultName', 'คนที่ทักแล้ว - ไม่ให้เห็นแอด')}
                  value={audienceName}
                  onChange={(e) => setAudienceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('audiences.retentionDays', 'เก็บข้อมูล (วัน)')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={730}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Math.min(730, Math.max(1, parseInt(e.target.value) || 365)))}
                />
              </div>
            </div>

            <Button onClick={handleCreate} disabled={creating || selectedPageIds.length === 0}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {t('audiences.create', 'สร้างกลุ่ม')}
            </Button>
          </CardContent>
        </Card>

        {/* Existing Audiences */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('audiences.existing', 'กลุ่มที่มีอยู่')}</CardTitle>
                <CardDescription>
                  {t('audiences.existingDesc', 'ใช้เป็น Exclusion ในขั้นตอนสร้างโฆษณา เพื่อไม่ให้คนในกลุ่มนี้เห็นแอด')}
                </CardDescription>
              </div>
              {adAccountId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAudiences}
                  disabled={loadingAudiences}
                >
                  {loadingAudiences ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2">{t('audiences.refresh', 'รีเฟรช')}</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!adAccountId ? (
              <p className="text-sm text-muted-foreground">{t('audiences.selectAccountFirst', 'เลือก Ad Account ก่อน')}</p>
            ) : loadingAudiences ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('audiences.loading', 'กำลังโหลด...')}
              </div>
            ) : audiencesError ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{audiencesError}</p>
                <Button variant="outline" size="sm" onClick={refreshAudiences}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('audiences.refresh', 'รีเฟรช')}
                </Button>
              </div>
            ) : audiences.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('audiences.noAudiences', 'ยังไม่มีกลุ่ม')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('audiences.noAudiencesHint', 'สร้างกลุ่ม Suppression ด้านบน หรือตรวจสอบว่าเลือก Ad Account ถูกต้อง (กลุ่มที่สร้างจะอยู่ใน Ad Account ที่เลือก)')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {audiences.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {a.id}
                        {a.approximate_count != null && ` · ~${a.approximate_count.toLocaleString()} คน`}
                      </p>
                    </div>
                    <Badge variant="secondary">{a.subtype || 'CUSTOM'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Note */}
        <Card className="border-blue-200 dark:border-blue-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              {t('audiences.usageTitle', 'วิธีใช้ Exclusion')}
            </CardTitle>
            <CardDescription>
              {t('audiences.usageDesc', 'เมื่อสร้างโฆษณาใน Create Ads ให้เลือกกลุ่ม Suppression นี้เป็น Exclusion — Centxo จะ exclude คนในกลุ่มจากโฆษณา ทำให้คนที่เคยทักแล้วไม่เห็นแอดอีก (ฟีเจอร์นี้จะเพิ่มใน Create Ads ในเวอร์ชันถัดไป)')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
