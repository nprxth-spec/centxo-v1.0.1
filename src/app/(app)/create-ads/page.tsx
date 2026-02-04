'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdAccount } from '@/contexts/AdAccountContext';
import {
  Loader2, Upload, FileVideo, FileImage, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft,
  Target, Wallet, Sparkles, Folder, X, Rocket, User, Newspaper, Search, Check, ChevronsUpDown, MessageCircle, Trash2,
  Globe, MoreHorizontal, ThumbsUp, MessageSquare, Share2, Play, Users,
} from 'lucide-react';
import {
  type UploadedMedia,
  type Beneficiary,
  type ProgressStep,
  type IceBreaker,
  type SavedTemplate,
  STEPS,
  COUNTRIES,
} from './types';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { NoFacebookAccountsPrompt } from '@/components/NoFacebookAccountsPrompt';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Types and constants imported from ./types.ts

export default function CreateAdsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const {
    selectedAccounts: adAccounts,  // Use only checked accounts from settings
    selectedPages: pages,          // Use only checked pages from settings
    adAccounts: allAdAccounts,     // All available accounts (to check if any exist)
    pages: allPages,               // All available pages (to check if any exist)
    loading: accountsLoading,
    refreshData,
  } = useAdAccount();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [library, setLibrary] = useState<UploadedMedia[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [selectedLibraryName, setSelectedLibraryName] = useState<string | null>(null);
  const [adSource, setAdSource] = useState<'upload' | 'library'>('upload');

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [beneficiaryError, setBeneficiaryError] = useState<string | null>(null);
  const [beneficiaryManualId, setBeneficiaryManualId] = useState('');

  // Search states for account/page selection
  const [accountSearch, setAccountSearch] = useState('');
  const [pageSearch, setPageSearch] = useState('');
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [pagePopoverOpen, setPagePopoverOpen] = useState(false);

  const [interestSearch, setInterestSearch] = useState('');
  const [foundInterests, setFoundInterests] = useState<any[]>([]);
  const [searchingInterests, setSearchingInterests] = useState(false);

  const [exclusionAudiences, setExclusionAudiences] = useState<{ id: string; name: string }[]>([]);
  const [loadingExclusionAudiences, setLoadingExclusionAudiences] = useState(false);
  const [useExclusionAudiences, setUseExclusionAudiences] = useState(false);

  const [ageMinInput, setAgeMinInput] = useState('20');
  const [ageMaxInput, setAgeMaxInput] = useState('50');

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryDeleteTarget, setLibraryDeleteTarget] = useState<{ id: string } | null>(null);
  const [libraryDeleting, setLibraryDeleting] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [noPrimaryText, setNoPrimaryText] = useState(false);
  const [noHeadline, setNoHeadline] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [iceBreakers, setIceBreakers] = useState<{ question: string; payload: string }[]>([]);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string; items: { question: string; payload: string }[] }[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingSavedTemplates, setLoadingSavedTemplates] = useState(false);

  const [form, setForm] = useState({
    adAccountId: '',
    pageId: '',
    campaignObjective: 'OUTCOME_ENGAGEMENT',
    targetCountry: 'TH',
    placements: ['facebook', 'instagram', 'messenger'] as string[],
    productContext: '',
    targetingType: 'ai' as 'ai' | 'manual',
    manualInterests: [] as { id: string; name: string }[],
    beneficiaryId: '',
    exclusionAudienceIds: [] as string[],
    ageMin: 20,
    ageMax: 50,
    dailyBudget: 20,
    campaignCount: 1,
    adSetCount: 1,
    adsCount: 1,
  });

  // Memoize computed values for performance
  const hasMedia = useMemo(() => !!mediaFile || !!selectedLibraryName, [mediaFile, selectedLibraryName]);
  const hasContent = hasMedia;

  const isVideo = () => {
    if (mediaFile) return mediaFile.type.startsWith('video/');
    if (selectedLibraryName) return /\.(mp4|mov|webm|avi)$/i.test(selectedLibraryName);
    return false;
  };

  // Load Facebook Ad Videos for selected Ad Account (Facebook Library)
  useEffect(() => {
    if (!form.adAccountId) {
      setLibrary([]);
      setLibraryLoading(false);
      return;
    }
    const controller = new AbortController();
    setLibraryLoading(true);
    fetch(`/api/facebook/ad-videos?adAccountId=${encodeURIComponent(form.adAccountId)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { videos: [] }))
      .then((data) => {
        const vids = (data.videos || []) as Array<{
          id: string;
          title?: string;
          source: string;
          thumbnail?: string;
          created_time?: string;
        }>;
        setLibrary(
          vids.map((v) => ({
            name: v.id,
            title: v.title || undefined,
            path: v.source,
            thumbnail: v.thumbnail,
            createdAt: v.created_time,
          })),
        );
      })
      .catch(() => setLibrary([]))
      .finally(() => setLibraryLoading(false));
    return () => controller.abort();
  }, [form.adAccountId]);

  useEffect(() => {
    if (!interestSearch || interestSearch.length < 2) {
      setFoundInterests([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearchingInterests(true);
      fetch(`/api/targeting/search?q=${encodeURIComponent(interestSearch)}`)
        .then((res) => res.json())
        .then((data) => setFoundInterests(data.interests || []))
        .finally(() => setSearchingInterests(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [interestSearch]);

  useEffect(() => {
    if (!form.adAccountId) {
      setExclusionAudiences([]);
      setForm((p) => ({ ...p, exclusionAudienceIds: [] }));
      return;
    }
    setLoadingExclusionAudiences(true);
    fetch(`/api/facebook/custom-audiences?adAccountId=${encodeURIComponent(form.adAccountId.startsWith('act_') ? form.adAccountId : `act_${form.adAccountId}`)}`)
      .then((r) => r.json())
      .then((d) => setExclusionAudiences((d.audiences || []).map((a: any) => ({ id: a.id, name: a.name || a.id }))))
      .catch(() => setExclusionAudiences([]))
      .finally(() => setLoadingExclusionAudiences(false));
  }, [form.adAccountId]);

  useEffect(() => {
    if (!form.adAccountId) {
      setBeneficiaries([]);
      setBeneficiaryError(null);
      setForm((p) => ({ ...p, beneficiaryId: '' }));
      return;
    }
    setLoadingBeneficiaries(true);
    setBeneficiaryError(null);
    const url = new URL('/api/facebook/beneficiaries', window.location.origin);
    url.searchParams.set('adAccountId', form.adAccountId);
    if (form.pageId) url.searchParams.set('pageId', form.pageId);
    fetch(url.toString())
      .then((res) => res.json())
      .then((data) => {
        const list = data.beneficiaries || [];
        setBeneficiaries(list);
        if (list.length > 0) setBeneficiaryError(null);
        else if (data.error) setBeneficiaryError(data.error);
        else setBeneficiaryError(null);
        if (list[0] && !form.beneficiaryId) setForm((p) => ({ ...p, beneficiaryId: list[0].id }));
      })
      .catch(() => {
        setBeneficiaries([]);
        setBeneficiaryError(null);
      })
      .finally(() => setLoadingBeneficiaries(false));
  }, [form.adAccountId, form.pageId]);

  useEffect(() => {
    if (currentStep === 3) {
      setAgeMinInput(String(form.ageMin));
      setAgeMaxInput(String(form.ageMax));
    }
    // Sync from form only when entering Strategy step; omit form from deps to avoid overwriting while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewIsVideo = useMemo(
    () => (!!mediaFile && mediaFile.type.startsWith('video/')) || !!selectedLibraryName,
    [mediaFile, selectedLibraryName]
  );

  useEffect(() => {
    let thumbUrl: string | null = null;
    let videoUrl: string | null = null;
    if (selectedLibraryName) {
      const lib = library.find((m) => m.name === selectedLibraryName);
      setPreviewMediaUrl(lib?.thumbnail || null);
      setPreviewVideoUrl(lib?.path || null);
      return () => {};
    }
    if (mediaFile) {
      if (mediaFile.type.startsWith('image/')) {
        thumbUrl = URL.createObjectURL(mediaFile);
        setPreviewMediaUrl(thumbUrl);
        setPreviewVideoUrl(null);
      } else {
        videoUrl = URL.createObjectURL(mediaFile);
        setPreviewVideoUrl(videoUrl);
        if (thumbnailFile) {
          thumbUrl = URL.createObjectURL(thumbnailFile);
          setPreviewMediaUrl(thumbUrl);
        } else {
          setPreviewMediaUrl(null);
        }
      }
    } else {
      setPreviewMediaUrl(null);
      setPreviewVideoUrl(null);
    }
    return () => {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [selectedLibraryName, library, mediaFile, thumbnailFile]);

  useEffect(() => {
    setPreviewVideoPlaying(false);
  }, [previewVideoUrl]);

  useEffect(() => {
    if (currentStep !== 4) return;
    fetch('/api/ice-breaker-templates')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setSavedTemplates(d.templates || []);
      })
      .catch(() => {});
  }, [currentStep]);

  const maxStep = STEPS.length;
  const nextStep = useCallback(() => {
    setError('');
    setCurrentStep((s) => Math.min(maxStep, s + 1));
  }, [maxStep]);
  const prevStep = useCallback(() => {
    setError('');
    setCurrentStep((s) => Math.max(1, s - 1));
  }, []);

  const canProceed = useCallback(() => {
    if (currentStep === 1) return !!form.adAccountId && !!form.pageId;
    if (currentStep === 2) return hasContent;
    if (currentStep === 3) return form.dailyBudget > 0;
    if (currentStep === 4) return true;
    return true;
  }, [currentStep, hasContent, form.adAccountId, form.pageId, form.dailyBudget]);

  const handleLaunch = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setIsProgressOpen(true);

    const steps: ProgressStep[] = [
      { id: 'prepare', label: t('createAds.progress.prepare', 'Preparing'), status: 'loading' },
      { id: 'ai', label: t('createAds.progress.ai', 'AI analysis'), status: 'pending' },
      { id: 'upload', label: t('createAds.progress.upload', 'Uploading'), status: 'pending' },
      { id: 'campaign', label: t('createAds.progress.campaign', 'Creating campaign'), status: 'pending' },
    ];
    setProgressSteps(steps);

    const advanceProgress = (id: string, status: ProgressStep['status']) => {
      setProgressSteps((p) => p.map((s) => (s.id === id ? { ...s, status } : s)));
    };

    const runProgressSimulation = () => {
      advanceProgress('prepare', 'completed');
      advanceProgress('ai', 'loading');
      setTimeout(() => {
        advanceProgress('ai', 'completed');
        advanceProgress('upload', 'loading');
      }, 1500);
      setTimeout(() => {
        advanceProgress('upload', 'completed');
        advanceProgress('campaign', 'loading');
      }, 3000);
    };

    runProgressSimulation();

    const buildFormData = () => {
      const fd = new FormData();
      const aid = form.adAccountId.startsWith('act_') ? form.adAccountId : `act_${form.adAccountId}`;
      fd.append('adAccountId', aid);
      fd.append('pageId', form.pageId);
      fd.append('campaignObjective', form.campaignObjective);
      fd.append('dailyBudget', String(form.dailyBudget));
      fd.append('campaignCount', String(form.campaignCount));
      fd.append('adSetCount', String(form.adSetCount));
      fd.append('adsCount', String(form.adsCount));
      fd.append('productContext', form.productContext);
      fd.append('targetCountry', form.targetCountry);
      fd.append('placements', form.placements.filter((p) => ['facebook', 'instagram', 'messenger'].includes(p)).join(','));
      fd.append('ageMin', String(Math.min(65, Math.max(18, form.ageMin))));
      fd.append('ageMax', String(Math.min(65, Math.max(18, form.ageMax))));
      const beneficiaryValue = beneficiaryManualId.trim() || form.beneficiaryId;
      if (beneficiaryValue) fd.append('beneficiaryName', beneficiaryValue);
      if (useExclusionAudiences && form.exclusionAudienceIds?.length) fd.append('exclusionAudienceIds', JSON.stringify(form.exclusionAudienceIds));
      fd.append('primaryText', noPrimaryText ? '' : primaryText);
      fd.append('headline', noHeadline ? '' : headline);
      if (greeting.trim()) fd.append('greeting', greeting.trim());
      const validIce = iceBreakers.filter((ib) => ib.question?.trim());
      if (validIce.length > 0) fd.append('manualIceBreakers', JSON.stringify(validIce));

      if (mediaFile) {
        fd.append('file', mediaFile);
        fd.append('mediaType', mediaFile.type.startsWith('video/') ? 'video' : 'image');
        if (thumbnailFile && isVideo()) fd.append('thumbnail', thumbnailFile);
      } else if (selectedLibraryName) {
        fd.append('existingFbVideoId', selectedLibraryName);
        fd.append('mediaType', 'video');
        const lib = library.find((m) => m.name === selectedLibraryName);
        if (lib) {
          fd.append('existingFbVideoUrl', lib.path);
          if (lib.thumbnail) fd.append('existingFbVideoThumbnailUrl', lib.thumbnail);
        }
        if (thumbnailFile && isVideo()) fd.append('thumbnail', thumbnailFile);
      } else {
        throw new Error(t('createAds.error.noMedia', 'Please select or upload media.'));
      }
      return fd;
    };

    const formatCreateError = (raw: string): string => {
      const s = (raw || '').toLowerCase();
      if (s.includes('หรือกรอก id') || s.includes('หรือระบุ id')) return raw;
      if (s.includes('token') && (s.includes('expired') || s.includes('invalid'))) return t('createAds.error.token', 'Token หมดอายุหรือไม่ถูกต้อง กรุณาเชื่อมต่อ Meta ใหม่ใน Settings');
      if (s.includes('facebook') && s.includes('connect')) return t('createAds.error.fbConnect', 'ยังไม่ได้เชื่อมต่อ Facebook กรุณาไปที่ Settings > Connections');
      if (s.includes('beneficiary') || s.includes('dsa')) return t('createAds.error.beneficiary', 'ไม่พบผู้รับผลประโยชน์ที่รองรับ กรุณาตั้งค่าใน Meta Business Manager');
      if (s.includes('permission') || s.includes('access')) return t('createAds.error.permission', 'ไม่มีสิทธิ์เข้าถึงบัญชีหรือเพจ กรุณาตรวจสอบ Meta Ads Manager');
      if (s.includes('invalid parameter')) return t('createAds.error.invalidParam', 'พารามิเตอร์แคมเปญไม่ถูกต้อง — ตรวจสอบ objective, Special Ad Categories หรือการตั้งค่าใน Meta Ads Manager');
      if (s.includes('โหมดพัฒนา') || s.includes('development mode')) return t('createAds.error.appDevMode', 'แอป Facebook อยู่ในโหมดพัฒนา กรุณาไปที่ Meta for Developers แล้วเปลี่ยนแอปเป็นโหมด Live (สาธารณะ) เพื่อสร้างโฆษณาได้');
      return raw;
    };

    const maxAttempts = 2;
    let lastError: string = '';

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let res: Response | null = null;
        try {
          const fd = buildFormData();
          res = await fetch('/api/campaigns/create', { method: 'POST', body: fd });
          let data: any = {};
          try {
            data = await res.json();
          } catch (_) {}
          if (!res.ok) {
            lastError = data?.error || data?.message || `HTTP ${res.status}`;
            throw new Error(lastError);
          }
          setProgressSteps((p) => p.map((s) => ({ ...s, status: 'completed' as const })));
          setSuccess(data.message || t('createAds.success', 'Campaign created!'));
          toast({ title: t('createAds.success', 'Campaign created!'), description: data.message, variant: 'default' });
          setTimeout(() => router.push('/ads-manager/campaigns?refresh=true'), 2200);
          return;
        } catch (err: any) {
          lastError = err?.message || 'Failed to create campaign';
          const isRetriable =
            (res != null && res.status >= 500) ||
            lastError.includes('Failed to fetch') ||
            lastError.includes('NetworkError');
          if (!isRetriable || attempt === maxAttempts) throw new Error(lastError);
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } catch (e: any) {
      const msg = formatCreateError(e?.message || 'Failed to create campaign');
      setError(msg);
      setProgressSteps((p) => p.map((s) => (s.status === 'loading' ? { ...s, status: 'error' as const } : s)));
      toast({ title: t('createAds.error.title', 'Error'), description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const togglePlacement = (p: string) => {
    setForm((prev) => ({
      ...prev,
      placements: prev.placements.includes(p)
        ? prev.placements.filter((x) => x !== p)
        : [...prev.placements, p],
    }));
  };

  const addManualInterest = (interest: any) => {
    if (form.manualInterests.some((i) => i.id === interest.id)) return;
    setForm((prev) => ({ ...prev, manualInterests: [...prev.manualInterests, interest] }));
    setInterestSearch('');
    setFoundInterests([]);
  };
  const removeManualInterest = (id: string) => {
    setForm((prev) => ({ ...prev, manualInterests: prev.manualInterests.filter((i) => i.id !== id) }));
  };

  if (accountsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if user has NO connected accounts at all vs just not selected any
  const hasAnyConnected = (allAdAccounts?.length ?? 0) > 0 || (allPages?.length ?? 0) > 0;
  const hasSelectedAccounts = (adAccounts?.length ?? 0) > 0;
  const hasSelectedPages = (pages?.length ?? 0) > 0;

  // If no accounts connected at all, show original prompt
  if (!hasAnyConnected) {
    return <NoFacebookAccountsPrompt />;
  }

  // If accounts exist but none selected, show prompt to select in settings
  if (!hasSelectedAccounts && !hasSelectedPages) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <Card className="p-12 max-w-md">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{t('createAds.noSelection.title', 'กรุณาเลือกบัญชีโฆษณาและเพจ')}</h3>
              <p className="text-muted-foreground">
                {t('createAds.noSelection.description', 'คุณยังไม่ได้เลือกบัญชีโฆษณาหรือเพจใน Settings กรุณาไปเลือกก่อนเพื่อใช้งานระบบสร้างแอดออโต้')}
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-4 w-full">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => router.push('/settings/connections?tab=ad-accounts')}
              >
                {t('createAds.noSelection.selectAccounts', 'เลือกบัญชีโฆษณา')}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => router.push('/settings/connections?tab=ad-accounts&view=pages')}
              >
                {t('createAds.noSelection.selectPages', 'เลือกเพจ')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const currentIcon = STEPS[currentStep - 1]?.icon ?? FileVideo;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h1 className="font-outfit text-2xl font-bold tracking-tight md:text-3xl">
            {t('createAds.title', 'ระบบสร้างแอดออโต้')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t('createAds.subtitle', 'สร้างแคมเปญโฆษณาได้ง่ายๆ AI ช่วยวิเคราะห์สื่อ และตั้งค่าให้อัตโนมัติ')}
          </p>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {STEPS.map((step) => {
              const done = step.id < currentStep;
              const active = step.id === currentStep;
              return (
                <div key={step.id} className="flex items-center gap-1.5">
                  <div
                    className={`
                      flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all
                      ${active ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : ''}
                      ${done ? 'bg-green-500 text-white' : ''}
                      ${!active && !done ? 'bg-muted text-muted-foreground' : ''}
                    `}
                  >
                    {done ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className={cn('h-4 w-4', !active && !done && 'iconClass' in step && step.iconClass)} />}
                  </div>
                  <span className={`hidden text-sm font-medium sm:inline ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {t(step.labelKey, step.label)}
                  </span>
                  {step.id < 5 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            {currentStep} / 5
          </Badge>
        </div>

        <Card className="overflow-hidden shadow-lg">
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="min-h-[420px] p-6 md:p-8"
              >
                {/* Step 1: Identity */}
                {currentStep === 1 && (
                  <div className="mx-auto max-w-md space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">{t('createAds.identity.title', 'บัญชีและเพจ')}</h2>
                      <p className="text-sm text-muted-foreground">{t('createAds.identity.subtitle', 'เลือก Ad Account, Facebook Page และ Beneficiary (ไม่บังคับ)')}</p>
                    </div>

                    {/* Ad Account - Searchable */}
                    <div className="space-y-2">
                      <Label>{t('createAds.identity.adAccount', 'Ad Account')}</Label>
                      <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={accountPopoverOpen}
                            className="w-full justify-between font-normal"
                          >
                            {form.adAccountId ? (
                              <span className="truncate">
                                {adAccounts.find((a) => a.account_id === form.adAccountId)?.name || form.adAccountId}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{t('createAds.identity.selectAccount', 'เลือกบัญชี')}</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                              placeholder={t('createAds.identity.searchAccount', 'ค้นหาบัญชี...')}
                              value={accountSearch}
                              onChange={(e) => setAccountSearch(e.target.value)}
                              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto overscroll-contain scrollbar-minimal">
                            <div className="p-1">
                              {adAccounts
                                .filter((a) =>
                                  !accountSearch ||
                                  a.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                                  a.account_id.includes(accountSearch) ||
                                  a.id.includes(accountSearch)
                                )
                                .map((a) => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => {
                                      setForm((p) => ({ ...p, adAccountId: a.account_id }));
                                      setAccountPopoverOpen(false);
                                      setAccountSearch('');
                                    }}
                                    className={`
                                      relative flex w-full cursor-pointer select-none items-center justify-between rounded-sm px-2 py-2 text-sm outline-none
                                      hover:bg-accent hover:text-accent-foreground
                                      ${form.adAccountId === a.account_id ? 'bg-accent' : ''}
                                    `}
                                  >
                                    <div className="flex flex-col text-left">
                                      <span className="font-medium">{a.name}</span>
                                      <span className="text-xs text-muted-foreground">ID: {a.account_id}</span>
                                    </div>
                                    {form.adAccountId === a.account_id && (
                                      <Check className="h-4 w-4 text-primary shrink-0" />
                                    )}
                                  </button>
                                ))}
                              {adAccounts.filter((a) =>
                                !accountSearch ||
                                a.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                                a.account_id.includes(accountSearch) ||
                                a.id.includes(accountSearch)
                              ).length === 0 && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                  {t('createAds.identity.noResults', 'ไม่พบผลลัพธ์')}
                                </div>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Facebook Page - Searchable */}
                    <div className="space-y-2">
                      <Label>{t('createAds.identity.page', 'Facebook Page')}</Label>
                      <Popover open={pagePopoverOpen} onOpenChange={setPagePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={pagePopoverOpen}
                            className="w-full justify-between font-normal"
                          >
                            {form.pageId ? (
                              <span className="truncate">
                                {pages.find((p) => p.id === form.pageId)?.name || form.pageId}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{t('createAds.identity.selectPage', 'เลือกเพจ')}</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                              placeholder={t('createAds.identity.searchPage', 'ค้นหาเพจ...')}
                              value={pageSearch}
                              onChange={(e) => setPageSearch(e.target.value)}
                              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto overscroll-contain scrollbar-minimal">
                            <div className="p-1">
                              {pages
                                .filter((p) =>
                                  !pageSearch ||
                                  p.name.toLowerCase().includes(pageSearch.toLowerCase()) ||
                                  p.id.includes(pageSearch)
                                )
                                .map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setForm((prev) => ({ ...prev, pageId: p.id }));
                                      setPagePopoverOpen(false);
                                      setPageSearch('');
                                    }}
                                    className={`
                                      relative flex w-full cursor-pointer select-none items-center justify-between rounded-sm px-2 py-2 text-sm outline-none
                                      hover:bg-accent hover:text-accent-foreground
                                      ${form.pageId === p.id ? 'bg-accent' : ''}
                                    `}
                                  >
                                    <div className="flex flex-col text-left">
                                      <span className="font-medium">{p.name}</span>
                                      <span className="text-xs text-muted-foreground">ID: {p.id}</span>
                                    </div>
                                    {form.pageId === p.id && (
                                      <Check className="h-4 w-4 text-primary shrink-0" />
                                    )}
                                  </button>
                                ))}
                              {pages.filter((p) =>
                                !pageSearch ||
                                p.name.toLowerCase().includes(pageSearch.toLowerCase()) ||
                                p.id.includes(pageSearch)
                              ).length === 0 && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                  {t('createAds.identity.noResults', 'ไม่พบผลลัพธ์')}
                                </div>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('createAds.identity.beneficiary', 'Beneficiary (optional)')}</Label>
                      {!form.adAccountId ? (
                        <div className="flex h-12 items-center rounded-lg border border-dashed text-sm text-muted-foreground px-4">
                          {t('createAds.identity.selectAccountFirst', 'Select an Ad Account first to load beneficiaries')}
                        </div>
                      ) : loadingBeneficiaries ? (
                        <div className="flex h-12 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('createAds.identity.loading', 'Loading…')}
                        </div>
                      ) : beneficiaries.length > 0 ? (
                        <Select value={form.beneficiaryId} onValueChange={(v) => setForm((p) => ({ ...p, beneficiaryId: v }))}>
                          <SelectTrigger className="h-auto min-h-12 py-2">
                            {form.beneficiaryId ? (
                              (() => {
                                const b = beneficiaries.find((x) => x.id === form.beneficiaryId);
                                const displayName = b?.name?.replace(/\s*\(ID:\s*\d+\)\s*$/, '').trim() || b?.name || form.beneficiaryId;
                                return (
                                  <div className="flex flex-col items-start gap-0.5 overflow-hidden text-left">
                                    <span className="font-medium truncate w-full">{displayName}</span>
                                    <span className="text-xs text-muted-foreground">ID: {form.beneficiaryId}</span>
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-muted-foreground">{t('createAds.identity.selectBeneficiary', 'Select beneficiary')}</span>
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {beneficiaries.map((b) => {
                              const displayName = b.name.replace(/\s*\(ID:\s*\d+\)\s*$/, '').trim() || b.name;
                              return (
                                <SelectItem key={b.id} value={b.id}>
                                  <div className="flex flex-col text-left py-1">
                                    <span className="font-medium">{displayName}</span>
                                    <span className="text-xs text-muted-foreground">ID: {b.id}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                          <div>
                            <p className="font-medium text-amber-800 dark:text-amber-200">{t('createAds.identity.noBeneficiary', 'No beneficiary found')}</p>
                            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                              {beneficiaryError || t('createAds.identity.noBeneficiaryHint', 'We only show verified persons/organizations (not business/page names). You can continue or set up in Meta Business Manager.')}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">{t('createAds.identity.beneficiaryManualLabel', 'หรือระบุ ID ผู้รับผลประโยชน์ (จากการอนุญาตและการตรวจสอบยืนยัน)')}</Label>
                        <Input
                          value={beneficiaryManualId}
                          onChange={(e) => setBeneficiaryManualId(e.target.value)}
                          placeholder={t('createAds.identity.beneficiaryManualPlaceholder', 'เช่น 1241218621371999')}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Content — Media */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">{t('createAds.media.title', 'สื่อโฆษณา')}</h2>
                      <p className="text-sm text-muted-foreground">{t('createAds.media.subtitle', 'อัปโหลดวิดีโอหรือรูป หรือเลือกจากไลบรารี')}</p>
                    </div>
                    <Tabs value={adSource} onValueChange={(v: any) => setAdSource(v)}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload">{t('createAds.media.upload', 'อัปโหลดใหม่')}</TabsTrigger>
                        <TabsTrigger value="library">{t('createAds.media.library', 'ไลบรารี')}</TabsTrigger>
                      </TabsList>
                      <TabsContent value="upload" className="mt-4 space-y-4">
                        <div
                          className={`
                            flex h-[17rem] min-h-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors
                            ${mediaFile ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/50'}
                          `}
                        >
                          <input
                            type="file"
                            accept="video/*,image/*"
                            className="hidden"
                            id="media-upload"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                setMediaFile(f);
                                setSelectedLibraryName(null);
                              }
                            }}
                          />
                          {mediaFile ? (
                            <div className="relative flex h-full w-full items-center justify-center bg-black/5">
                              {mediaFile.type.startsWith('video/') ? (
                                <video src={URL.createObjectURL(mediaFile)} className="max-h-full max-w-full object-contain" controls muted />
                              ) : (
                                <img src={URL.createObjectURL(mediaFile)} alt="" className="max-h-full max-w-full object-contain" />
                              )}
                              <div className="absolute right-2 top-2 flex gap-2">
                                <Label htmlFor="media-upload" className="cursor-pointer">
                                  <span className="rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-background">
                                    {t('createAds.media.replace', 'เปลี่ยน')}
                                  </span>
                                </Label>
                                <Button type="button" variant="destructive" size="sm" onClick={() => setMediaFile(null)}>
                                  {t('createAds.media.remove', 'ลบ')}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Label htmlFor="media-upload" className="flex cursor-pointer flex-col items-center gap-2 py-8">
                              <Upload className="h-12 w-12 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground">{t('createAds.media.click', 'คลิกเพื่ออัปโหลด')}</span>
                              <span className="text-xs text-muted-foreground">Video / Image</span>
                            </Label>
                          )}
                        </div>
                        {mediaFile && mediaFile.type.startsWith('video/') && (
                          <div className="space-y-2">
                            <Label>{t('createAds.media.thumbnail', 'ธัมบ์เนิล (ไม่บังคับ)')}</Label>
                            {!thumbnailFile ? (
                              <div className="flex rounded-lg border-2 border-dashed border-muted-foreground/25 p-4">
                                <Label className="flex cursor-pointer items-center gap-2">
                                  <FileImage className="h-5 w-5 text-muted-foreground" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                                  />
                                  {t('createAds.media.thumbnailUpload', 'อัปโหลดรูป')}
                                </Label>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                                <img src={URL.createObjectURL(thumbnailFile)} alt="" className="h-14 w-24 rounded object-cover" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{thumbnailFile.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {(thumbnailFile.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setThumbnailFile(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="library" className="mt-4">
                        <div className="flex h-[17rem] min-h-0 flex-col overflow-hidden rounded-xl border bg-muted/20 p-4">
                          <div className="mb-3 flex shrink-0 items-center justify-between">
                            <span className="font-medium">{t('createAds.media.library', 'ไลบรารี')}</span>
                            <Button variant="outline" size="sm" onClick={() => setIsLibraryOpen(true)}>
                              {t('createAds.media.viewAll', 'ดูทั้งหมด')}
                            </Button>
                          </div>
                          <ScrollArea className="min-h-0 flex-1">
                            {libraryLoading ? (
                              <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                                {t('createAds.media.loadingLibrary', 'กำลังโหลดไลบรารี…')}
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-4 gap-2">
                                  {library.slice(0, 8).map((m) => {
                                    const sel = selectedLibraryName === m.name;
                                    return (
                                      <button
                                        key={m.name}
                                        type="button"
                                        onClick={() => {
                                          setSelectedLibraryName(m.name);
                                          setMediaFile(null);
                                        }}
                                        className={`
                                          group relative flex flex-col overflow-hidden rounded-lg border-2 transition-all
                                          ${sel ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-muted-foreground/50'}
                                        `}
                                      >
                                        <div className="aspect-square w-full overflow-hidden bg-muted">
                                          {m.thumbnail ? (
                                            <img
                                              src={m.thumbnail}
                                              alt={m.title || m.name}
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                              <FileVideo className="h-8 w-8 text-muted-foreground/50" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                                          VIDEO
                                        </div>
                                        <div className="line-clamp-1 px-1 pb-1 pt-0.5 text-[10px] text-muted-foreground text-left w-full" title={m.title || m.name}>
                                          {m.title || m.name}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                {library.length === 0 && (
                                  <div className="flex h-32 flex-col items-center justify-center text-sm text-muted-foreground">
                                    <Folder className="mb-2 h-8 w-8 opacity-50" />
                                    {t('createAds.media.emptyLibrary', 'ยังไม่มีไฟล์')}
                                  </div>
                                )}
                              </>
                            )}
                          </ScrollArea>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {/* Step 3: Target & audience + Budget & structure */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">{t('createAds.strategy.title', 'เป้าหมายและกลุ่ม')}</h2>
                      <p className="text-sm text-muted-foreground">{t('createAds.strategy.subtitle', 'ตั้งค่า Objective, ประเทศ, Placements และ Product Context')}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>{t('createAds.strategy.objective', 'วัตถุประสงค์')}</Label>
                        <Select
                          value={form.campaignObjective}
                          onValueChange={(v) => setForm((p) => ({ ...p, campaignObjective: v }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OUTCOME_ENGAGEMENT">{t('createAds.strategy.engagement', 'Engagement (แนะนำ)')}</SelectItem>
                            <SelectItem value="OUTCOME_TRAFFIC">Traffic</SelectItem>
                            <SelectItem value="OUTCOME_SALES">Sales</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('createAds.strategy.country', 'ประเทศเป้าหมาย')}</Label>
                        <Select
                          value={form.targetCountry}
                          onValueChange={(v) => setForm((p) => ({ ...p, targetCountry: v }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>{t('createAds.strategy.age', 'ช่วงอายุ')}</Label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="18"
                            value={ageMinInput}
                            onChange={(e) => {
                              const s = e.target.value.replace(/\D/g, '');
                              setAgeMinInput(s);
                            }}
                            onBlur={() => {
                              const minVal = Math.min(65, Math.max(18, parseInt(ageMinInput, 10) || 18));
                              const maxVal = Math.max(form.ageMax, minVal);
                              setForm((p) => ({ ...p, ageMin: minVal, ageMax: maxVal }));
                              setAgeMinInput(String(minVal));
                              setAgeMaxInput(String(maxVal));
                            }}
                            className="w-14 h-8 text-sm"
                          />
                          <span className="text-muted-foreground text-sm">–</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="65"
                            value={ageMaxInput}
                            onChange={(e) => {
                              const s = e.target.value.replace(/\D/g, '');
                              setAgeMaxInput(s);
                            }}
                            onBlur={() => {
                              const maxVal = Math.min(65, Math.max(18, parseInt(ageMaxInput, 10) || 50));
                              const minVal = Math.min(form.ageMin, maxVal);
                              setForm((p) => ({ ...p, ageMin: minVal, ageMax: maxVal }));
                              setAgeMinInput(String(minVal));
                              setAgeMaxInput(String(maxVal));
                            }}
                            className="w-14 h-8 text-sm"
                          />
                          <span className="text-muted-foreground text-sm shrink-0">{t('createAds.strategy.years', 'ปี')}</span>
                          <Button
                            type="button"
                            variant={form.ageMin >= 25 ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 px-2 text-xs shrink-0"
                            onClick={() => {
                              const minVal = 25;
                              const maxVal = Math.max(form.ageMax, 25);
                              setForm((p) => ({ ...p, ageMin: minVal, ageMax: maxVal }));
                              setAgeMinInput('25');
                              setAgeMaxInput(String(maxVal));
                            }}
                          >
                            25+
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {t('createAds.strategy.ageNoteShort', 'อ้างอิงจากโปรไฟล์ FB · เด็กอาจใส่อายุผิด ลอง 25+')}
                        </p>
                      </div>
                    </div>

                    {/* กลุ่มยกเว้น - เลือกใช้อันไหนบ้าง */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0" />
                          {t('createAds.exclusion.title', 'กลุ่มยกเว้น')}
                        </Label>
                        <Switch checked={useExclusionAudiences} onCheckedChange={setUseExclusionAudiences} />
                      </div>
                      {useExclusionAudiences && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {loadingExclusionAudiences ? (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {t('createAds.exclusion.loading', 'โหลด...')}
                            </span>
                          ) : exclusionAudiences.length === 0 ? (
                            <span className="text-muted-foreground">
                              {t('createAds.exclusion.empty', 'ยังไม่มีกลุ่ม')}{' '}
                              <Link href="/audiences" className="text-primary hover:underline">{t('createAds.exclusion.goToAudiences', 'ไปที่กลุ่มเป้าหมาย')}</Link>
                            </span>
                          ) : (
                            exclusionAudiences.map((a) => {
                              const selected = form.exclusionAudienceIds?.includes(a.id);
                              return (
                                <Badge
                                  key={a.id}
                                  variant={selected ? 'default' : 'outline'}
                                  className="cursor-pointer gap-1 pr-1 py-0.5 text-xs"
                                  onClick={() => {
                                    setForm((p) => ({
                                      ...p,
                                      exclusionAudienceIds: selected
                                        ? (p.exclusionAudienceIds || []).filter((id) => id !== a.id)
                                        : [...(p.exclusionAudienceIds || []), a.id],
                                    }));
                                  }}
                                >
                                  {selected && <Check className="h-3 w-3" />}
                                  <span className="truncate max-w-[140px]">{a.name}</span>
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('createAds.strategy.placements', 'Placements')}</Label>
                      <div className="flex flex-wrap gap-4">
                        {['facebook', 'instagram', 'messenger'].map((p) => (
                          <label key={p} className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={form.placements.includes(p)}
                              onChange={() => togglePlacement(p)}
                              className="h-4 w-4 rounded"
                            />
                            <span className="text-sm capitalize">{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('createAds.strategy.productContext', 'Product Context (ไม่บังคับ)')}</Label>
                      <Textarea
                        value={form.productContext}
                        onChange={(e) => setForm((p) => ({ ...p, productContext: e.target.value }))}
                        placeholder={t('createAds.strategy.productPlaceholder', "เช่น สินค้าแฟชั่น ราคาดี ส่งฟรี")}
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="font-medium">{t('createAds.strategy.targeting', 'Targeting')}</Label>
                      <Tabs value={form.targetingType} onValueChange={(v: any) => setForm((p) => ({ ...p, targetingType: v }))}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="ai"><Sparkles className="mr-2 h-4 w-4" />{t('createAds.strategy.ai', 'AI อัตโนมัติ')}</TabsTrigger>
                          <TabsTrigger value="manual">{t('createAds.strategy.manual', 'เลือกเอง')}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="ai" className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                          {t('createAds.strategy.aiDesc', 'AI จะวิเคราะห์สื่อและ Product Context แล้วเลือกกลุ่มเป้าหมายให้')}
                        </TabsContent>
                        <TabsContent value="manual" className="space-y-3">
                          <Input
                            placeholder={t('createAds.strategy.searchInterests', 'ค้นหา interest...')}
                            value={interestSearch}
                            onChange={(e) => setInterestSearch(e.target.value)}
                          />
                          {searchingInterests && <p className="text-xs text-muted-foreground">{t('createAds.strategy.searching', 'Searching…')}</p>}
                          {foundInterests.length > 0 && (
                            <ScrollArea className="h-28 rounded border bg-background p-2">
                              {foundInterests.map((i) => (
                                <div
                                  key={i.id}
                                  className="flex cursor-pointer justify-between rounded px-2 py-1.5 text-sm hover:bg-muted"
                                  onClick={() => addManualInterest(i)}
                                >
                                  <span className="font-medium">{i.name}</span>
                                  <span className="text-xs text-muted-foreground">{i.audience}</span>
                                </div>
                              ))}
                            </ScrollArea>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {form.manualInterests.map((i) => (
                              <Badge key={i.id} variant="secondary" className="gap-1 pr-1">
                                {i.name}
                                <Button type="button" variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0" onClick={() => removeManualInterest(i.id)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-base font-semibold">{t('createAds.budget.title', 'งบประมาณและโครงสร้าง')}</h3>
                      <p className="text-sm text-muted-foreground">{t('createAds.budget.subtitle', 'กำหนดงบรายวัน และจำนวน Campaign / Ad Set / Ads')}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t('createAds.budget.daily', 'งบรายวัน (บาท/ดอลลาร์)')}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={form.dailyBudget}
                          onChange={(e) => setForm((p) => ({ ...p, dailyBudget: Math.max(1, Number(e.target.value) || 1) }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label>{t('createAds.budget.structure', 'โครงสร้าง')}</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Campaigns</Label>
                          <Input
                            type="number"
                            min={1}
                            className="text-center"
                            value={form.campaignCount}
                            onChange={(e) => setForm((p) => ({ ...p, campaignCount: Math.max(1, parseInt(String(e.target.value)) || 1) }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Ad Sets</Label>
                          <Input
                            type="number"
                            min={1}
                            className="text-center"
                            value={form.adSetCount}
                            onChange={(e) => setForm((p) => ({ ...p, adSetCount: Math.max(1, parseInt(String(e.target.value)) || 1) }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Ads</Label>
                          <Input
                            type="number"
                            min={1}
                            className="text-center"
                            value={form.adsCount}
                            onChange={(e) => setForm((p) => ({ ...p, adsCount: Math.max(1, parseInt(String(e.target.value)) || 1) }))}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('createAds.budget.hint', 'ใช้ค่าเริ่มต้น 1 Campaign, 1 Ad Set, 3 Ads ได้เลย')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 5: ADS & แชท */}
                {currentStep === 4 && (
                  <div className="mx-auto max-w-lg space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">{t('createAds.ads.title', 'ข้อความโฆษณา & เครื่องมือสร้างแชท')}</h2>
                      <p className="text-sm text-muted-foreground">{t('createAds.ads.subtitle', 'ข้อความหลัก/พาดหัวสอดคล้องกับสื่อ • ประสบการณ์แชทหลังกดโฆษณา')}</p>
                    </div>
                    {hasMedia && (
                      <>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              setAnalyzeLoading(true);
                              setError('');
                              try {
                                const fd = new FormData();
                                fd.append('productContext', form.productContext);
                                fd.append('adSetCount', String(Math.max(1, form.adSetCount)));
                                fd.append('adsCount', String(Math.max(1, form.adsCount)));
                                if (mediaFile) {
                                  fd.append('file', mediaFile);
                                  if (thumbnailFile && isVideo()) fd.append('thumbnails', thumbnailFile);
                                } else if (selectedLibraryName) {
                                  const lib = library.find((m) => m.name === selectedLibraryName);
                                  if (lib?.path) {
                                    fd.append('existingMediaPath', lib.path);
                                    fd.append('existingMediaUrl', lib.path);
                                    if (lib.thumbnail) fd.append('existingThumbnailUrl', lib.thumbnail);
                                  }
                                }
                                const res = await fetch('/api/ai/analyze-media', { method: 'POST', body: fd });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || 'Analyze failed');
                                const d = data.data || data;
                                if (!noPrimaryText) setPrimaryText(d.primaryText || '');
                                if (!noHeadline) setHeadline(d.headline || '');
                                setGreeting(typeof d.greeting === 'string' ? d.greeting : '');
                                setIceBreakers(Array.isArray(d.iceBreakers) ? d.iceBreakers : []);
                                // Age range stays from Strategy & Budget step — do NOT overwrite with AI
                                toast({ title: t('createAds.ads.analyzed', 'วิเคราะห์สื่อเสร็จแล้ว'), variant: 'default' });
                              } catch (e) {
                                const msg = e instanceof Error ? e.message : 'Analyze failed';
                                setError(msg);
                                toast({ title: t('createAds.ads.analyzeError', 'วิเคราะห์ไม่สำเร็จ'), description: msg, variant: 'destructive' });
                              } finally {
                                setAnalyzeLoading(false);
                              }
                            }}
                            disabled={analyzeLoading}
                          >
                            {analyzeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            {t('createAds.ads.analyze', 'วิเคราะห์สื่อ (AI)')}
                          </Button>
                          <span className="text-xs text-muted-foreground">{t('createAds.ads.analyzeHint', 'เติมข้อความและแชทจากเนื้อหา')}</span>
                        </div>
                        <Separator />
                      </>
                    )}
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Label>{t('createAds.ads.primaryText', 'ข้อความหลัก')}</Label>
                          <label className="flex items-center gap-2 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={noPrimaryText}
                              onChange={(e) => {
                                setNoPrimaryText(e.target.checked);
                                if (e.target.checked) setPrimaryText('');
                              }}
                              className="h-4 w-4 rounded"
                            />
                            <span className="text-xs">{t('createAds.ads.noPrimaryText', 'ไม่ใส่ข้อความในโพสต์')}</span>
                          </label>
                        </div>
                        <Textarea
                          value={primaryText}
                          onChange={(e) => setPrimaryText(e.target.value)}
                          placeholder={t('createAds.ads.primaryPlaceholder', 'ข้อความโฆษณาหลัก — สอดคล้องกับวิดีโอ/รูป')}
                          rows={4}
                          className="resize-none mt-1"
                          disabled={noPrimaryText}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Label>{t('createAds.ads.headline', 'ข้อความพาดหัว')}</Label>
                          <label className="flex items-center gap-2 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={noHeadline}
                              onChange={(e) => {
                                setNoHeadline(e.target.checked);
                                if (e.target.checked) setHeadline('');
                              }}
                              className="h-4 w-4 rounded"
                            />
                            <span className="text-xs">{t('createAds.ads.noHeadline', 'ไม่ใส่พาดหัว')}</span>
                          </label>
                        </div>
                        <Input
                          value={headline}
                          onChange={(e) => setHeadline(e.target.value)}
                          placeholder={t('createAds.ads.headlinePlaceholder', 'หัวข้อสั้นๆ ให้คลิก')}
                          className="mt-1"
                          disabled={noHeadline}
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          {t('createAds.ads.chatTool', 'เครื่องมือสร้างแชท')}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-3">{t('createAds.ads.chatToolDesc', 'สร้างประสบการณ์การส่งข้อความที่ผู้คนจะเห็นหลังจากแตะที่โฆษณาของคุณ')}</p>
                        <div className="space-y-2 mb-4">
                          <Label className="text-sm font-medium">{t('createAds.ads.greeting', 'คำทักทาย')}</Label>
                          <Input
                            value={greeting}
                            onChange={(e) => setGreeting(e.target.value)}
                            placeholder={t('createAds.ads.greetingPlaceholder', 'สนใจ พิมพ์ "เข้ากลุ่ม"')}
                            className="font-normal"
                            maxLength={300}
                          />
                          <p className="text-xs text-muted-foreground">{t('createAds.ads.greetingHint', 'ข้อความต้อนรับเมื่อผู้ใช้กดส่งข้อความ (สูงสุด 300 ตัวอักษร)')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4 items-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loadingSavedTemplates}
                            onClick={async () => {
                              setLoadingSavedTemplates(true);
                              try {
                                const r = await fetch('/api/ice-breaker-templates');
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error || 'โหลดไม่สำเร็จ');
                                setSavedTemplates(d.templates || []);
                                if ((d.templates || []).length > 0) toast({ title: t('createAds.ads.loadedSaved', 'โหลดเทมเพลตที่บันทึกไว้แล้ว'), variant: 'default' });
                              } catch (e) {
                                toast({ title: t('createAds.ads.loadSavedError', 'โหลดเทมเพลตไม่สำเร็จ'), description: e instanceof Error ? e.message : '', variant: 'destructive' });
                              } finally {
                                setLoadingSavedTemplates(false);
                              }
                            }}
                          >
                            {loadingSavedTemplates ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {t('createAds.ads.loadSaved', 'โหลดเทมเพลตที่บันทึกไว้')}
                          </Button>
                          {savedTemplates.length > 0 && (
                            <Select onValueChange={(id) => {
                              const tpl = savedTemplates.find((x) => x.id === id);
                              if (tpl?.items) setIceBreakers(tpl.items);
                            }}>
                              <SelectTrigger className="w-[200px]"><SelectValue placeholder={t('createAds.ads.selectSaved', 'เลือกเทมเพลตที่บันทึก')} /></SelectTrigger>
                              <SelectContent>
                                {savedTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                          <Input
                            placeholder={t('createAds.ads.saveTemplateName', 'ชื่อเทมเพลต')}
                            value={saveTemplateName}
                            onChange={(e) => setSaveTemplateName(e.target.value)}
                            className="w-40"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={savingTemplate || iceBreakers.filter((ib) => ib.question?.trim()).length === 0 || !saveTemplateName.trim()}
                            onClick={async () => {
                              const valid = iceBreakers.filter((ib) => ib.question?.trim());
                              if (!valid.length || !saveTemplateName.trim()) return;
                              setSavingTemplate(true);
                              try {
                                const r = await fetch('/api/ice-breaker-templates', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name: saveTemplateName.trim(), items: valid }),
                                });
                                const d = await r.json();
                                if (!r.ok) throw new Error(d.error || 'Save failed');
                                setSaveTemplateName('');
                                setSavedTemplates(d.templates || []);
                                toast({ title: t('createAds.ads.savedTemplate', 'บันทึกเทมเพลตแล้ว'), variant: 'default' });
                              } catch (e) {
                                toast({ title: t('createAds.ads.saveError', 'บันทึกไม่สำเร็จ'), description: e instanceof Error ? e.message : '', variant: 'destructive' });
                              } finally {
                                setSavingTemplate(false);
                              }
                            }}
                          >
                            {savingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('createAds.ads.saveTemplate', 'บันทึกเป็นเทมเพลต')}
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {iceBreakers.map((ib, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <Input
                                value={ib.question}
                                onChange={(e) => setIceBreakers((p) => p.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x)))}
                                placeholder={t('createAds.ads.iceQuestion', 'คำถาม')}
                                className="flex-1"
                              />
                              <Input
                                value={ib.payload}
                                onChange={(e) => setIceBreakers((p) => p.map((x, i) => (i === idx ? { ...x, payload: e.target.value } : x)))}
                                placeholder="Payload"
                                className="w-32"
                              />
                              <Button type="button" variant="ghost" size="icon" onClick={() => setIceBreakers((p) => p.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
                            </div>
                          ))}
                          {iceBreakers.length < 4 && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setIceBreakers((p) => [...p, { question: '', payload: '' }])}>
                              + {t('createAds.ads.addIce', 'เพิ่มคำถาม')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 6: Review */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">{t('createAds.review.title', 'สรุปและเริ่ม')}</h2>
                      <p className="text-sm text-muted-foreground">{t('createAds.review.subtitle', 'ตรวจสอบแล้วกด Launch')}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* Left: Ad preview (Feed) */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('createAds.review.previewLabel', 'Ad preview (Feed)')}</p>
                        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                        {/* Header: avatar, name, Sponsored */}
                        <div className="flex items-center gap-3 px-3 py-2">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                            {(() => {
                              const page = pages?.find((p) => p.id === form.pageId) as { picture?: string | { data?: { url?: string } }; name?: string } | undefined;
                              const pic = !page ? null : typeof page.picture === 'string' ? page.picture : (page.picture as any)?.data?.url;
                              return pic ? (
                                <img src={pic} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-sm font-semibold text-muted-foreground">
                                  {(pages?.find((p) => p.id === form.pageId)?.name || 'P').slice(0, 1)}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {pages?.find((p) => p.id === form.pageId)?.name || form.pageId || t('createAds.review.page', 'Page')}
                            </p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="h-3 w-3 shrink-0" />
                              {t('createAds.review.sponsored', 'ได้รับการสนับสนุน')}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" className="rounded p-1.5 hover:bg-muted" aria-label="Menu">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button type="button" className="rounded p-1.5 hover:bg-muted" aria-label="Close">
                              <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>

                        {/* Ad copy */}
                        <div className="px-3 pb-2">
                          <p className="line-clamp-4 whitespace-pre-wrap text-sm">
                            {primaryText || t('createAds.review.noCopy', 'ไม่มีข้อความ')}
                          </p>
                        </div>

                        {/* Media */}
                        <div className="relative aspect-square w-full bg-black/5">
                          {previewIsVideo && previewVideoUrl ? (
                            <>
                              <video
                                ref={previewVideoRef}
                                src={previewVideoUrl}
                                poster={previewMediaUrl || undefined}
                                controls
                                playsInline
                                className="h-full w-full object-contain"
                                onPlay={() => setPreviewVideoPlaying(true)}
                                onPause={() => setPreviewVideoPlaying(false)}
                                onEnded={() => setPreviewVideoPlaying(false)}
                              />
                              {!previewVideoPlaying && (
                                <button
                                  type="button"
                                  onClick={() => previewVideoRef.current?.play()}
                                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-none"
                                  aria-label={t('createAds.review.playVideo', 'เล่นวิดีโอ')}
                                >
                                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white">
                                    <Play className="h-7 w-7 ml-0.5" fill="currentColor" />
                                  </span>
                                </button>
                              )}
                            </>
                          ) : previewMediaUrl ? (
                            <img
                              src={previewMediaUrl}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                              <FileVideo className="h-12 w-12 opacity-50" />
                              <span className="text-xs">{t('createAds.review.media', 'สื่อ')}</span>
                            </div>
                          )}
                        </div>

                        {/* Messenger CTA */}
                        <div className="flex items-center gap-3 border-t bg-muted/30 px-3 py-2.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                            {previewMediaUrl ? (
                              <img src={previewMediaUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <MessageCircle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Messenger</p>
                            <p className="truncate text-xs font-medium">{t('createAds.review.chatMessenger', 'แชทใน Messenger')}</p>
                          </div>
                          <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="flex shrink-0 items-center gap-2 rounded-lg bg-[#0084FF] px-3 py-2 text-xs font-medium text-white hover:bg-[#0073e6]"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {t('createAds.review.sendMessage', 'ส่งข้อความ')}
                          </a>
                        </div>

                        {/* Engagement bar */}
                        <div className="flex items-center justify-around border-t px-2 py-1.5 text-muted-foreground">
                          <button type="button" className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs hover:bg-muted">
                            <ThumbsUp className="h-4 w-4" />
                            {t('createAds.review.like', 'ถูกใจ')}
                          </button>
                          <button type="button" className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs hover:bg-muted">
                            <MessageSquare className="h-4 w-4" />
                            {t('createAds.review.comment', 'แสดงความคิดเห็น')}
                          </button>
                          <button type="button" className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs hover:bg-muted">
                            <Share2 className="h-4 w-4" />
                            {t('createAds.review.share', 'แชร์')}
                          </button>
                        </div>
                        </div>
                      </div>

                      {/* Right: Details */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('createAds.review.detailsLabel', 'Details')}</p>
                        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Media</span>
                            <span className="font-medium">{mediaFile?.name || selectedLibraryName || '-'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Objective</span>
                            <span className="font-medium">{form.campaignObjective}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Country</span>
                            <span className="font-medium">{form.targetCountry}</span>
                          </div>
                          {(greeting.trim() || iceBreakers.some((ib) => ib.question?.trim())) && (
                            <div className="flex justify-between text-sm gap-2">
                              <span className="text-muted-foreground shrink-0">{t('createAds.ads.greeting', 'คำทักทาย')} / Chat</span>
                              <span className="font-medium text-right truncate">
                                {greeting.trim() ? `"${greeting.slice(0, 60)}${greeting.length > 60 ? '…' : ''}"` : ''}
                                {greeting.trim() && iceBreakers.some((ib) => ib.question?.trim()) ? ' · ' : ''}
                                {iceBreakers.filter((ib) => ib.question?.trim()).length > 0
                                  ? `${iceBreakers.filter((ib) => ib.question?.trim()).length} ${t('createAds.ads.iceQuestion', 'คำถาม')}`
                                  : ''}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('createAds.strategy.age', 'ช่วงอายุ')}</span>
                            <span className="font-medium">{form.ageMin} – {form.ageMax} {t('createAds.strategy.years', 'ปี')}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ad Account / Page</span>
                            <span className="font-medium">
                              {adAccounts.find((a) => a.account_id === form.adAccountId)?.name ?? adAccounts[0]?.name ?? '-'} / {pages.find((p) => p.id === form.pageId)?.name ?? '-'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Budget</span>
                            <span className="font-medium">{form.dailyBudget} / day · {form.campaignCount}C / {form.adSetCount}AS / {form.adsCount} Ads</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-6 py-4">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 1 || loading}>
              <ChevronLeft className="mr-2 h-4 w-4" /> {t('createAds.back', 'ย้อนกลับ')}
            </Button>
            {currentStep < 5 ? (
              <Button onClick={nextStep} disabled={!canProceed() || loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('createAds.next', 'ถัดไป')} <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleLaunch} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                {t('createAds.launch', 'Launch')}
              </Button>
            )}
          </div>
        </Card>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Progress Dialog */}
      <Dialog open={isProgressOpen} onOpenChange={setIsProgressOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('createAds.progress.title', 'กำลังสร้างแคมเปญ')}</DialogTitle>
            <DialogDescription>{t('createAds.progress.desc', 'กรุณารอสักครู่...')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {progressSteps.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                {s.status === 'completed' && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />}
                {s.status === 'loading' && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />}
                {s.status === 'error' && <div className="h-5 w-5 shrink-0 rounded-full border-2 border-destructive" />}
                {s.status === 'pending' && <div className="h-5 w-5 shrink-0 rounded-full border-2 border-muted" />}
                <span className={s.status === 'completed' ? 'text-foreground' : 'text-muted-foreground'}>{s.label}</span>
              </div>
            ))}
            {success && (
              <div className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
                {success}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Library Dialog */}
      <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('createAds.dialog.library.title', 'ไลบรารีสื่อ')}</DialogTitle>
            <DialogDescription>{t('createAds.dialog.library.desc', 'เลือกวิดีโอหรือรูปสำหรับโฆษณา')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-md border scrollbar-minimal">
            {libraryLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin opacity-50" />
                {t('createAds.media.loadingLibrary', 'กำลังโหลดไลบรารี…')}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-4 p-4 sm:grid-cols-5 md:grid-cols-6">
                  {library.map((m) => {
                    const sel = selectedLibraryName === m.name;
                    const isDeleting = libraryDeleteTarget?.id === m.name && libraryDeleting;
                    return (
                      <div
                        key={m.name}
                        className={`group relative flex flex-col overflow-hidden rounded-lg border-2 transition-all ${sel ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-muted-foreground/50'}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLibraryName(m.name);
                            setMediaFile(null);
                            setIsLibraryOpen(false);
                          }}
                          className="flex flex-1 flex-col text-left"
                        >
                          <div className="aspect-square w-full overflow-hidden bg-muted">
                            {m.thumbnail ? (
                              <img
                                src={m.thumbnail}
                                alt={m.title || m.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <FileVideo className="h-8 w-8 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                          <div className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                            VIDEO
                          </div>
                          <div className="line-clamp-1 px-1 pb-1 pt-0.5 text-[10px] text-muted-foreground text-left w-full" title={m.title || m.name}>
                            {m.title || m.name}
                          </div>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-1 top-1 h-7 w-7 rounded-md bg-destructive/90 text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                          disabled={isDeleting}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLibraryDeleteTarget({ id: m.name });
                          }}
                          title={t('createAds.dialog.library.delete', 'ลบ')}
                        >
                          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {library.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Folder className="mb-3 h-12 w-12 opacity-50" />
                    {t('createAds.media.emptyLibrary', 'ยังไม่มีไฟล์')}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!libraryDeleteTarget} onOpenChange={(open) => !open && setLibraryDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('createAds.dialog.library.delete', 'ลบ')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('createAds.dialog.library.deleteConfirm', 'ลบวิดีโอนี้จากคลังเฟสบุค? ไม่สามารถย้อนกลับได้')}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={libraryDeleting}>{t('common.cancel', 'ยกเลิก')}</AlertDialogCancel>
            <Button
              type="button"
              disabled={libraryDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!libraryDeleteTarget || !form.adAccountId) return;
                setLibraryDeleting(true);
                try {
                  const r = await fetch(
                    `/api/facebook/ad-videos/${encodeURIComponent(libraryDeleteTarget.id)}?adAccountId=${encodeURIComponent(form.adAccountId)}`,
                    { method: 'DELETE' }
                  );
                  const data = await r.json().catch(() => ({}));
                  if (!r.ok) throw new Error(data?.error || 'Delete failed');
                  const deletedId = libraryDeleteTarget.id;
                  setLibrary((prev) => prev.filter((x) => x.name !== deletedId));
                  if (selectedLibraryName === deletedId) {
                    setSelectedLibraryName(null);
                    setMediaFile(null);
                  }
                  setLibraryDeleteTarget(null);
                  toast({
                    title: t('createAds.dialog.library.deleted', 'ลบวิดีโอจากคลังแล้ว'),
                    variant: 'default',
                  });
                } catch (err: any) {
                  toast({
                    title: t('createAds.dialog.library.deleteError', 'ลบวิดีโอไม่สำเร็จ'),
                    description: err?.message || '',
                    variant: 'destructive',
                  });
                } finally {
                  setLibraryDeleting(false);
                }
              }}
            >
              {libraryDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('createAds.dialog.library.delete', 'ลบ')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
