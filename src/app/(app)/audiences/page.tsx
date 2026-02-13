'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdAccount } from '@/contexts/AdAccountContext';
import {
  Users, Loader2, Plus, Check, ChevronsUpDown, Search, Shield, ExternalLink, RefreshCw, Target, Trash2, CheckCircle2, XCircle, Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const AUDIENCE_TYPE_KEYS = [
  'page_engaged', 'page_visited', 'page_messaged', 'page_post_interaction',
  'page_cta_clicked', 'page_or_post_save', 'page_liked',
] as const;

interface CustomAudience {
  id: string;
  name: string;
  subtype?: string;
  approximate_count?: number;
  time_created?: string;
  accountId?: string;
  accountName?: string;
}

type TabKey = 'engagement' | 'lookalike' | 'interest';

interface InterestPreset {
  id: string;
  name: string;
  description?: string | null;
  interests: Array<{ id: string; name: string }>;
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
    planLimits,
  } = useAdAccount();

  const adAccounts = selectedAccounts ?? [];
  const pages = selectedPages ?? [];

  const [activeTab, setActiveTab] = useState<TabKey>('engagement');
  const [adAccountIds, setAdAccountIds] = useState<string[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [audienceName, setAudienceName] = useState('');
  const [retentionDays, setRetentionDays] = useState(365);
  const [audienceTypes, setAudienceTypes] = useState<string[]>(['page_messaged']);
  const [audiences, setAudiences] = useState<CustomAudience[]>([]);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [audiencesError, setAudiencesError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState<Record<string, 'creating' | 'success' | 'error'>>({});
  const [pageSearch, setPageSearch] = useState('');
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [pagePopoverOpen, setPagePopoverOpen] = useState(false);
  const [audienceTypePopoverOpen, setAudienceTypePopoverOpen] = useState(false);

  const [lookalikeOriginId, setLookalikeOriginId] = useState('');
  const [lookalikeName, setLookalikeName] = useState('');
  const [lookalikeCountry, setLookalikeCountry] = useState('TH');
  const [lookalikeRatio, setLookalikeRatio] = useState(0.01);
  const [lookalikeType, setLookalikeType] = useState<'similarity' | 'reach'>('similarity');
  const [lookalikeOriginOpen, setLookalikeOriginOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomAudience | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Interest (AI) state
  const [interestDescription, setInterestDescription] = useState('');
  const [interestManualInput, setInterestManualInput] = useState('');
  const [interestGenerating, setInterestGenerating] = useState(false);
  const [suggestedInterests, setSuggestedInterests] = useState<Array<{ id: string; name: string }>>([]);
  const [interestPresetName, setInterestPresetName] = useState('');
  const [interestPresets, setInterestPresets] = useState<InterestPreset[]>([]);
  const [interestSaving, setInterestSaving] = useState(false);
  const [interestDeleteTarget, setInterestDeleteTarget] = useState<InterestPreset | null>(null);
  const [interestDeleting, setInterestDeleting] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const displayAccountId = adAccountIds[0] || '';
  const hasAccounts = adAccounts.length > 0;
  const hasPages = pages.length > 0;

  const getCachedAudiences = useCallback((cacheKey: string): CustomAudience[] => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((a: any) => a?.id) : [];
    } catch { return []; }
  }, []);

  const getCacheKey = useCallback((actId: string) => {
    const norm = actId.replace(/^act_/, '');
    return `audiences_cache_act_${norm}`;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('audiences_adAccountIds');
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr)) setAdAccountIds(arr);
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && adAccountIds.length > 0) {
      try {
        localStorage.setItem('audiences_adAccountIds', JSON.stringify(adAccountIds));
      } catch { /* ignore */ }
    }
  }, [adAccountIds]);

  useEffect(() => {
    if (adAccounts.length > 0 && adAccountIds.length === 0) {
      const first = adAccounts[0];
      const aid = first?.id || first?.account_id;
      if (aid) setAdAccountIds([aid]);
    }
  }, [adAccounts]);

  const loadAudiences = useCallback(() => {
    const ids = adAccountIds.length > 0 ? adAccountIds : (displayAccountId ? [displayAccountId] : []);
    if (ids.length === 0) {
      setAudiences([]);
      return;
    }
    setLoadingAudiences(true);
    setAudiencesError(null);
    const norm = (id: string) => (String(id || '').startsWith('act_') ? id : `act_${id}`);
    Promise.all(
      ids.map((actId) => {
        const n = norm(actId);
        return fetch(`/api/facebook/custom-audiences?adAccountId=${encodeURIComponent(n)}`, { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => ({ actId: n, data: d, ok: !d.error }));
      })
    )
      .then((results) => {
        const merged: CustomAudience[] = [];
        let err: string | null = null;
        results.forEach(({ actId, data, ok }) => {
          const acc = adAccounts.find((a: any) => (a.id || a.account_id) === actId || (a.id || a.account_id) === actId.replace(/^act_/, ''));
          const accountName = acc?.name || actId;
          if (!ok || data.error) err = err || data.error || 'Failed';
          else {
            (data.audiences || []).forEach((a: any) => {
              if (a?.id) merged.push({ ...a, accountId: actId, accountName });
            });
          }
        });
        setAudiencesError(err);
        if (err && merged.length === 0) setAudiences([]);
        else setAudiences(merged);
      })
      .catch((err) => {
        setAudiencesError(err?.message || 'Failed to load audiences');
        setAudiences([]);
      })
      .finally(() => setLoadingAudiences(false));
  }, [adAccountIds, displayAccountId, adAccounts]);

  useEffect(() => {
    if (adAccountIds.length > 0 || displayAccountId) loadAudiences();
    else setAudiences([]);
  }, [adAccountIds.length, displayAccountId, loadAudiences]);

  const loadInterestPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/facebook/interest-audiences', { cache: 'no-store' });
      const data = await res.json();
      if (data.presets) setInterestPresets(data.presets);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (activeTab === 'interest') loadInterestPresets();
  }, [activeTab, loadInterestPresets]);

  const handleGenerateInterest = async () => {
    const manual = interestManualInput.trim();
    const desc = interestDescription.trim();
    if (!manual && (!desc || desc.length < 5)) {
      toast({ title: t('audiences.interest.placeholder'), variant: 'destructive' });
      return;
    }
    setInterestGenerating(true);
    setSuggestedInterests([]);
    try {
      const adAccountId = adAccountIds[0] || displayAccountId;
      const body: Record<string, unknown> = {
        action: 'generate',
        adAccountId: adAccountId || undefined,
      };
      if (manual) body.manualInterests = manual;
      else body.description = desc;
      const res = await fetch('/api/facebook/interest-audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 || data.code === 'AI_QUOTA_EXCEEDED') {
          toast({ title: t('audiences.interest.aiQuotaError'), variant: 'destructive' });
          return;
        }
        throw new Error(data.error || 'Failed');
      }
      const list = data.validated || data.interests?.map((n: string) => ({ id: '', name: n })) || [];
      setSuggestedInterests(list);
      if (data.suggestedName) setInterestPresetName(data.suggestedName);
      else if (manual && !interestPresetName) setInterestPresetName(manual.split(/[,،、;]+/)[0]?.trim() || '');
    } catch (e: any) {
      toast({ title: e.message || 'Failed', variant: 'destructive' });
    } finally {
      setInterestGenerating(false);
    }
  };

  const handleSaveInterestPreset = async () => {
    if (!interestPresetName.trim() || suggestedInterests.length === 0) {
      toast({ title: t('audiences.interest.presetName'), variant: 'destructive' });
      return;
    }
    setInterestSaving(true);
    try {
      const res = await fetch('/api/facebook/interest-audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          name: interestPresetName.trim(),
          description: interestDescription.trim() || undefined,
          interests: suggestedInterests,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: t('audiences.interest.saved'), variant: 'default' });
      setSuggestedInterests([]);
      setInterestPresetName('');
      setInterestDescription('');
      setInterestManualInput('');
      loadInterestPresets();
    } catch (e: any) {
      toast({ title: e.message || 'Failed', variant: 'destructive' });
    } finally {
      setInterestSaving(false);
    }
  };

  const handleDeleteInterestPreset = async () => {
    if (!interestDeleteTarget) return;
    setInterestDeleting(true);
    try {
      const res = await fetch('/api/facebook/interest-audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', presetId: interestDeleteTarget.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      toast({ title: t('audiences.deleted'), variant: 'default' });
      setInterestPresets((p) => p.filter((x) => x.id !== interestDeleteTarget.id));
    } catch (e: any) {
      toast({ title: e.message || 'Failed', variant: 'destructive' });
    } finally {
      setInterestDeleting(false);
      setInterestDeleteTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.accountId) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/facebook/custom-audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', audienceId: deleteTarget.id, adAccountId: deleteTarget.accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: t('audiences.deleted'), variant: 'default' });
      setAudiences((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch (e: any) {
      toast({ title: e.message || 'Failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleAccount = (accountId: string) => {
    setAdAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  const selectAllAccounts = () => {
    const all = adAccounts.map((a: any) => a.id || a.account_id).filter(Boolean);
    setAdAccountIds((prev) => (prev.length === all.length ? [] : all));
  };

  const togglePage = (pageId: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const selectAllPages = () => {
    const all = filteredPages.map((p: any) => p.id);
    setSelectedPageIds((prev) => (prev.length === all.length ? [] : all));
  };

  const toggleAudienceType = (type: string) => {
    setAudienceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleCreateEngagement = async () => {
    if (adAccountIds.length === 0 || selectedPageIds.length === 0) {
      toast({ title: t('audiences.error.selectPages'), variant: 'destructive' });
      return;
    }
    const name = audienceName.trim() || t('audiences.defaultName');
    setCreating(true);
    setCreationProgress(Object.fromEntries(adAccountIds.map((id) => [id, 'creating'])));
    let totalSuccess = 0;
    const payload = {
      name,
      pageIds: selectedPageIds,
      retentionDays,
      audienceTypes: audienceTypes.length > 0 ? audienceTypes : ['page_messaged'],
    };
    const runOne = async (actId: string) => {
      try {
        const res = await fetch('/api/facebook/custom-audiences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, adAccountIds: [actId] }),
        });
        const data = await res.json();
        const ok = res.ok && !data.error && (data.created > 0 || (data.results?.filter((r: any) => r.id)?.length ?? 0) > 0);
        setCreationProgress((p) => ({ ...p, [actId]: ok ? 'success' : 'error' }));
        return ok ? 1 : 0;
      } catch {
        setCreationProgress((p) => ({ ...p, [actId]: 'error' }));
        return 0;
      }
    };
    const results = await Promise.all(adAccountIds.map(runOne));
    totalSuccess = results.reduce<number>((a, b) => a + b, 0);
    if (totalSuccess > 0) {
      toast({ title: `${t('audiences.created')} ${totalSuccess}`, variant: 'default' });
      setAudienceName('');
      setSelectedPageIds([]);
      loadAudiences();
    } else {
      toast({ title: t('audiences.statusError'), variant: 'destructive' });
    }
    setCreating(false);
    setTimeout(() => setCreationProgress({}), 2000);
  };

  const handleCreateLookalike = async () => {
    if (!lookalikeOriginId || !lookalikeName.trim() || adAccountIds.length === 0) {
      toast({ title: t('audiences.error.selectPages'), variant: 'destructive' });
      return;
    }
    setCreating(true);
    setCreationProgress(Object.fromEntries(adAccountIds.map((id) => [id, 'creating'])));
    const payload = {
      action: 'create_lookalike' as const,
      name: lookalikeName.trim(),
      originAudienceId: lookalikeOriginId,
      lookalikeCountry,
      lookalikeRatio,
      lookalikeType,
    };
    const runOne = async (actId: string) => {
      try {
        const res = await fetch('/api/facebook/custom-audiences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, adAccountIds: [actId] }),
        });
        const data = await res.json();
        const ok = res.ok && !data.error && (data.results?.filter((r: any) => r.id)?.length ?? 0) > 0;
        setCreationProgress((p) => ({ ...p, [actId]: ok ? 'success' : 'error' }));
        return ok ? 1 : 0;
      } catch {
        setCreationProgress((p) => ({ ...p, [actId]: 'error' }));
        return 0;
      }
    };
    const results = await Promise.all(adAccountIds.map(runOne));
    const totalSuccess = results.reduce<number>((a, b) => a + b, 0);
    if (totalSuccess > 0) {
      toast({ title: `${t('audiences.lookalikeCreatedSuccess')} ${totalSuccess}`, variant: 'default' });
      setLookalikeName('');
      setLookalikeOriginId('');
      loadAudiences();
    } else {
      toast({ title: t('audiences.statusError'), variant: 'destructive' });
    }
    setCreating(false);
    setTimeout(() => setCreationProgress({}), 2000);
  };

  const filteredPages = pages.filter(
    (p: any) =>
      !pageSearch ||
      (p.name || '').toLowerCase().includes(pageSearch.toLowerCase()) ||
      (p.id || '').includes(pageSearch)
  );

  if (!mounted || accountsLoading) {
    return (
      <div className="container max-w-5xl py-8">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!hasAccounts || !hasPages) {
    return (
      <div className="container max-w-5xl py-8">
        <div className="mb-8">
          <h1 className="text-page-title flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-500" />
            {t('audiences.title', 'กลุ่มเป้าหมาย (Custom Audiences)')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('audiences.subtitleAdv')}</p>
        </div>
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Users className="h-12 w-12 text-amber-600" />
              <div>
                <h3 className="font-semibold">{t('audiences.selectFromSettingsFirst')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('audiences.selectFromSettingsDescPrefix')}
                  <Link href="/settings?tab=team" className="underline hover:text-foreground font-medium text-foreground">
                    {t('audiences.selectFromSettingsDescLink')}
                  </Link>
                  {t('audiences.selectFromSettingsDescSuffix')}
                </p>
              </div>
              <Button asChild>
                <Link href="/settings?tab=team">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('audiences.goToSettingsShort')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8">
        <h1 className="text-page-title flex items-center gap-2">
          <Users className="h-7 w-7 text-indigo-500" />
          {t('audiences.title', 'กลุ่มเป้าหมาย (Custom Audiences)')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('audiences.subtitleAdv')}</p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button variant={activeTab === 'engagement' ? 'default' : 'outline'} onClick={() => setActiveTab('engagement')}>
          {t('audiences.tab.engagement')}
        </Button>
        <Button variant={activeTab === 'lookalike' ? 'default' : 'outline'} onClick={() => setActiveTab('lookalike')}>
          {t('audiences.tab.lookalike')}
        </Button>
        <Button
          variant={activeTab === 'interest' ? 'default' : 'outline'}
          onClick={() => {
            if (planLimits?.aiAccess) setActiveTab('interest');
          }}
          disabled={!planLimits?.aiAccess}
          className={!planLimits?.aiAccess ? "opacity-50 cursor-not-allowed" : ""}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          {t('audiences.tab.interest')}
          {!planLimits?.aiAccess && <Badge variant="secondary" className="ml-2 h-5 px-1 text-[10px]">PRO</Badge>}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Multi-Account + Create Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === 'engagement' && t('audiences.createEngagement')}
              {activeTab === 'lookalike' && t('audiences.createLookalike')}
              {activeTab === 'interest' && t('audiences.interest.title')}
            </CardTitle>
            <CardDescription>
              {activeTab === 'engagement' && t('audiences.createEngagementDesc')}
              {activeTab === 'lookalike' && t('audiences.createLookalikeDesc')}
              {activeTab === 'interest' && t('audiences.interest.desc')}
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-2">
              <Link href="/settings?tab=team" className="inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> {t('audiences.selectFromSettings')}
              </Link>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('audiences.adAccountMulti')}</Label>
              <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {adAccountIds.length > 0 ? (
                      <span>{adAccountIds.length} {t('audiences.accountsSelected')}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('audiences.selectAccountPlaceholder')}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
                  <div className="border-b px-3 py-2">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium hover:bg-accent"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button[role="checkbox"]')) return;
                        selectAllAccounts();
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAllAccounts(); } }}
                    >
                      <Checkbox checked={adAccountIds.length === adAccounts.length && adAccounts.length > 0} onCheckedChange={selectAllAccounts} />
                      {t('audiences.selectAll')}
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    {adAccounts.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-accent">
                        <Checkbox
                          checked={adAccountIds.includes(a.id || a.account_id)}
                          onCheckedChange={() => toggleAccount(a.id || a.account_id)}
                        />
                        <div className="flex flex-col text-left min-w-0">
                          <span className="truncate text-sm font-medium">{a.name || '-'}</span>
                          <span className="text-xs text-muted-foreground">ID: {a.account_id || a.id || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {activeTab === 'engagement' && (
              <>
                <div className="space-y-2">
                  <Label>{t('audiences.audienceType')}</Label>
                  <Popover open={audienceTypePopoverOpen} onOpenChange={setAudienceTypePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {audienceTypes.length > 0 ? (
                          <span>{audienceTypes.length} {t('audiences.typesSelected')}</span>
                        ) : (
                          <span className="text-muted-foreground">{t('audiences.selectType')}</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
                      <div className="max-h-[320px] overflow-y-auto p-1">
                        {AUDIENCE_TYPE_KEYS.map((key) => (
                          <div
                            key={key}
                            className="flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-accent cursor-pointer"
                            onClick={() => toggleAudienceType(key)}
                          >
                            <Checkbox checked={audienceTypes.includes(key)} onCheckedChange={() => toggleAudienceType(key)} />
                            <span className="text-sm">{t(`audiences.type.${key}`)}</span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>{t('audiences.pagesMulti')}</Label>
                  <Popover open={pagePopoverOpen} onOpenChange={setPagePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {selectedPageIds.length > 0 ? <span>{selectedPageIds.length} {t('audiences.pagesSelected')}</span> : <span className="text-muted-foreground">{t('audiences.selectPagesPlaceholder')}</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
                      <div className="border-b px-3 py-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                          <input
                            placeholder={t('audiences.searchPages')}
                            value={pageSearch}
                            onChange={(e) => setPageSearch(e.target.value)}
                            className="flex h-9 w-full bg-transparent text-sm outline-none"
                          />
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium hover:bg-accent"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button[role="checkbox"]')) return;
                            selectAllPages();
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAllPages(); } }}
                        >
                          <Checkbox
                            checked={filteredPages.length > 0 && filteredPages.every((p: any) => selectedPageIds.includes(p.id))}
                            onCheckedChange={selectAllPages}
                          />
                          {t('audiences.selectAll')}
                        </div>
                      </div>
                      <div className="max-h-[280px] overflow-y-auto p-1">
                        {filteredPages.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-accent">
                            <Checkbox checked={selectedPageIds.includes(p.id)} onCheckedChange={() => togglePage(p.id)} />
                            <div className="flex flex-col text-left min-w-0">
                              <span className="truncate text-sm font-medium">{p.name || '-'}</span>
                              <span className="text-xs text-muted-foreground">ID: {p.id || '-'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('audiences.audienceName')}</Label>
                    <Input placeholder={t('audiences.defaultName')} value={audienceName} onChange={(e) => setAudienceName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('audiences.retentionNote')}</Label>
                    <Input type="number" min={1} max={730} value={retentionDays} onChange={(e) => setRetentionDays(Math.min(730, Math.max(1, parseInt(e.target.value) || 365)))} />
                  </div>
                </div>

                <Button onClick={handleCreateEngagement} disabled={creating || selectedPageIds.length === 0 || adAccountIds.length === 0}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {t('audiences.createEngagementBtn')}
                </Button>
                {creating && Object.keys(creationProgress).length > 0 && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                    <p className="text-sm font-medium">{t('audiences.creatingProgress')}</p>
                    <div className="space-y-1">
                      {adAccountIds.map((actId) => {
                        const acc = adAccounts.find((a: any) => (a.id || a.account_id) === actId);
                        const name = acc?.name || actId;
                        const status = creationProgress[actId];
                        return (
                          <div key={actId} className="flex items-center gap-2 text-sm">
                            {status === 'creating' && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                            {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
                            {status === 'error' && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                            <span className="truncate">{name}</span>
                            {status === 'success' && <span className="text-muted-foreground text-xs">({t('audiences.statusSuccess')})</span>}
                            {status === 'error' && <span className="text-muted-foreground text-xs">({t('audiences.statusError')})</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'interest' && (
              <>
                <div className="space-y-2">
                  <Label>{t('audiences.interest.desc')} (ใช้ AI)</Label>
                  <textarea
                    placeholder={t('audiences.interest.placeholder')}
                    value={interestDescription}
                    onChange={(e) => setInterestDescription(e.target.value)}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('audiences.interest.manualLabel')}</Label>
                  <Input
                    placeholder={t('audiences.interest.manualPlaceholder')}
                    value={interestManualInput}
                    onChange={(e) => setInterestManualInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('audiences.interest.manualHint')}
                  </p>
                </div>
                {adAccountIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('audiences.adAccountMulti')}: {adAccountIds.length} {t('audiences.accountsSelected')} — {t('audiences.interest.validateHint')}
                  </p>
                )}
                <Button
                  onClick={handleGenerateInterest}
                  disabled={interestGenerating || (interestDescription.trim().length < 5 && !interestManualInput.trim())}
                >
                  {interestGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {interestGenerating
                    ? t('audiences.interest.generating')
                    : interestManualInput.trim()
                      ? t('audiences.interest.validateBtn')
                      : t('audiences.interest.generate')}
                </Button>
                {suggestedInterests.length > 0 && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">{t('audiences.interest.suggested')}</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedInterests.map((i, idx) => (
                        <Badge key={`${i.id}-${idx}`} variant="secondary">
                          {i.name}
                          {i.id && <span className="ml-1 text-xs opacity-70">✓</span>}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t('audiences.interest.presetName')}
                        value={interestPresetName}
                        onChange={(e) => setInterestPresetName(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button onClick={handleSaveInterestPreset} disabled={interestSaving || !interestPresetName.trim()}>
                        {interestSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {t('audiences.interest.savePreset')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'lookalike' && (
              <>
                <div className="space-y-2">
                  <Label>{t('audiences.seedAudience')}</Label>
                  <Popover open={lookalikeOriginOpen} onOpenChange={setLookalikeOriginOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {lookalikeOriginId ? audiences.find((a) => a.id === lookalikeOriginId)?.name || lookalikeOriginId : <span className="text-muted-foreground">{t('audiences.selectAudience')}</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="max-h-[280px] overflow-y-auto p-1">
                        {audiences.filter((a) => a.subtype !== 'LOOKALIKE').map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm hover:bg-accent"
                            onClick={() => {
                              setLookalikeOriginId(a.id);
                              setLookalikeOriginOpen(false);
                            }}
                          >
                            <span className="truncate">{a.name}</span>
                            {lookalikeOriginId === a.id && <Check className="h-4 w-4" />}
                          </button>
                        ))}
                        {audiences.filter((a) => a.subtype !== 'LOOKALIKE').length === 0 && (
                          <p className="px-2 py-4 text-sm text-muted-foreground">{t('audiences.noSeedHint')}</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('audiences.lookalikeName')}</Label>
                    <Input placeholder="Lookalike 1%" value={lookalikeName} onChange={(e) => setLookalikeName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('audiences.lookalikeCountry')}</Label>
                    <Input value={lookalikeCountry} onChange={(e) => setLookalikeCountry(e.target.value)} placeholder="TH" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('audiences.lookalikeRatio')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      value={lookalikeRatio * 100}
                      onChange={(e) => setLookalikeRatio((parseInt(e.target.value) || 1) / 100)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('audiences.lookalikeType')}</Label>
                    <div className="flex gap-2">
                      <Button variant={lookalikeType === 'similarity' ? 'default' : 'outline'} size="sm" onClick={() => setLookalikeType('similarity')}>
                        {t('audiences.similarity')}
                      </Button>
                      <Button variant={lookalikeType === 'reach' ? 'default' : 'outline'} size="sm" onClick={() => setLookalikeType('reach')}>
                        {t('audiences.reach')}
                      </Button>
                    </div>
                  </div>
                </div>
                <Button onClick={handleCreateLookalike} disabled={creating || !lookalikeOriginId || !lookalikeName.trim() || adAccountIds.length === 0}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                  {t('audiences.createLookalikeBtn')}
                </Button>
                {creating && Object.keys(creationProgress).length > 0 && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                    <p className="text-sm font-medium">{t('audiences.creatingProgress')}</p>
                    <div className="space-y-1">
                      {adAccountIds.map((actId) => {
                        const acc = adAccounts.find((a: any) => (a.id || a.account_id) === actId);
                        const name = acc?.name || actId;
                        const status = creationProgress[actId];
                        return (
                          <div key={actId} className="flex items-center gap-2 text-sm">
                            {status === 'creating' && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                            {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
                            {status === 'error' && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                            <span className="truncate">{name}</span>
                            {status === 'success' && <span className="text-muted-foreground text-xs">({t('audiences.statusSuccess')})</span>}
                            {status === 'error' && <span className="text-muted-foreground text-xs">({t('audiences.statusError')})</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Saved Interest Presets (Interest tab only) */}
        {activeTab === 'interest' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('audiences.interest.savedPresets')}</CardTitle>
              <CardDescription>{t('audiences.interest.useInCreateAds')}</CardDescription>
            </CardHeader>
            <CardContent>
              {interestPresets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('audiences.interest.noPresets')}</p>
              ) : (
                <div className="space-y-2">
                  {interestPresets.map((p) => {
                    const list = Array.isArray(p.interests) ? p.interests : [];
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{p.name}</p>
                          {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {list.slice(0, 5).map((i: any, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {i.name}
                              </Badge>
                            ))}
                            {list.length > 5 && <span className="text-xs text-muted-foreground">+{list.length - 5}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/create?tab=auto">{t('audiences.interest.useInCreateAds')}</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setInterestDeleteTarget(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Existing Audiences (Engagement/Lookalike only) */}
        {activeTab !== 'interest' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('audiences.existing')}</CardTitle>
                  <CardDescription>{t('audiences.existingDescAdv')}</CardDescription>
                </div>
                {(adAccountIds.length > 0 || displayAccountId) && (
                  <Button variant="outline" size="sm" onClick={loadAudiences} disabled={loadingAudiences}>
                    {loadingAudiences ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2">{t('audiences.refresh')}</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!displayAccountId && adAccountIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('audiences.selectAccountFirst')}</p>
              ) : loadingAudiences ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('audiences.loading')}
                </div>
              ) : audiencesError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{audiencesError}</p>
                  <Button variant="outline" size="sm" onClick={loadAudiences}>
                    <RefreshCw className="mr-2 h-4 w-4" /> {t('audiences.refresh')}
                  </Button>
                </div>
              ) : audiences.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('audiences.noAudiences')}</p>
              ) : (
                <div className="space-y-2">
                  {audiences.map((a) => (
                    <div key={`${a.accountId}-${a.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {a.id}
                          {a.accountName && ` · ${t('audiences.ofAccount')}: ${a.accountName}`}
                          {a.approximate_count != null && a.approximate_count >= 0 && ` · ~${a.approximate_count.toLocaleString()} คน`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{a.subtype || 'CUSTOM'}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(a)}
                          disabled={!a.accountId}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-blue-200 dark:border-blue-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              {t('audiences.usageTitleAdv')}
            </CardTitle>
            <CardDescription>
              <strong>{t('audiences.usageInclusion')}</strong>
              <br />
              <strong>{t('audiences.usageExclusion')}</strong>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('audiences.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t('audiences.deleteConfirm').replace('{name}', deleteTarget.name) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('audiences.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!interestDeleteTarget} onOpenChange={(open) => !open && setInterestDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('audiences.interest.deletePreset')}</AlertDialogTitle>
            <AlertDialogDescription>
              {interestDeleteTarget ? t('audiences.deleteConfirm').replace('{name}', interestDeleteTarget.name) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDeleteInterestPreset(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {interestDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('audiences.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
