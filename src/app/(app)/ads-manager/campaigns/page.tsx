'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Edit2, Play, Pause, Loader2, Search, Filter, RefreshCw, Download, Plus, X, ExternalLink, ArrowUp, ArrowDown, ArrowUpDown, FileImage, LayoutGrid, Briefcase, Folder, Columns2 } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAdAccount } from '@/contexts/AdAccountContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DatePickerWithRange } from '@/components/DateRangePicker';

import { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ChevronDown } from "lucide-react";

import { showCustomToast, showErrorToast, showWarningToast } from "@/utils/custom-toast";
import { ExportDialog } from "@/components/ExportDialog";
import { cn } from "@/lib/utils";
import { formatCurrencyByCode } from "@/lib/currency-utils";


interface Campaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  messages: number;
  costPerMessage: number;
  dailyBudget: number;
  lifetimeBudget?: number;
  createdAt: string;
  adAccountId?: string;
  results?: number;
  costPerResult?: number;
  budget?: number;
  reach?: number;
  impressions?: number;
  postEngagements?: number;
  clicks?: number;
  messagingContacts?: number;
  amountSpent?: number;
  currency?: string;
  effectiveStatus?: string;
  configuredStatus?: string;
  spendCap?: number;
  issuesInfo?: any[];
  adSets?: { effectiveStatus: string; ads?: { effectiveStatus: string }[] }[];
}

interface AdSet {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  dailyBudget: number;
  lifetimeBudget: number;
  optimizationGoal: string;
  billingEvent: string;
  bidAmount: number;
  targeting?: any;
  createdAt: string;
  adAccountId?: string;
  results?: number;
  costPerResult?: number;
  budget?: number;
  reach?: number;
  impressions?: number;
  postEngagements?: number;
  clicks?: number;
  messagingContacts?: number;
  amountSpent?: number;
  currency?: string;
  effectiveStatus?: string;
  configuredStatus?: string;
  issuesInfo?: any[];
  ads?: { effectiveStatus: string }[];
}

interface Ad {
  id: string;
  name: string;
  status: string;
  adsetId: string;
  campaignId: string;
  campaignName?: string | null;
  adSetName?: string | null;
  creativeId: string;
  creativeName: string;
  title: string;
  body: string;
  imageUrl: string | null;
  targeting?: any;
  createdAt: string;
  adAccountId?: string;
  pageId?: string | null;
  pageName?: string | null;
  pageUsername?: string | null;
  results?: number;
  costPerResult?: number;
  budget?: number;
  budgetSource?: 'campaign' | 'adset';
  budgetType?: 'daily' | 'lifetime';
  campaignDailyBudget?: number;
  campaignLifetimeBudget?: number;
  adsetDailyBudget?: number;
  adsetLifetimeBudget?: number;
  reach?: number;
  impressions?: number;
  postEngagements?: number;
  clicks?: number;
  messagingContacts?: number;
  amountSpent?: number;
  currency?: string;
  postLink?: string | null;
  effectiveStatus?: string;
  configuredStatus?: string;
  issuesInfo?: any[];
}

type TabKey = 'campaigns' | 'adsets' | 'ads';

const COLUMN_CONFIG: Record<TabKey, { id: string; labelKey: string }[]> = {
  campaigns: [
    { id: 'adAccount', labelKey: 'campaigns.columns.adAccount' },
    { id: 'name', labelKey: 'campaigns.columns.name' },
    { id: 'status', labelKey: 'campaigns.columns.status' },
    { id: 'results', labelKey: 'campaigns.columns.results' },
    { id: 'costPerResult', labelKey: 'campaigns.columns.costPerResult' },
    { id: 'budget', labelKey: 'campaigns.columns.budget' },
    { id: 'reach', labelKey: 'campaigns.columns.reach' },
    { id: 'impressions', labelKey: 'campaigns.columns.impressions' },
    { id: 'postEngagements', labelKey: 'campaigns.columns.postEngagements' },
    { id: 'clicks', labelKey: 'campaigns.columns.clicks' },
    { id: 'messagingContacts', labelKey: 'campaigns.columns.messagingContacts' },
    { id: 'amountSpent', labelKey: 'campaigns.columns.amountSpent' },
    { id: 'createdAt', labelKey: 'campaigns.columns.created' },
  ],
  adsets: [
    { id: 'adAccount', labelKey: 'campaigns.columns.adAccount' },
    { id: 'name', labelKey: 'campaigns.columns.adSetName' },
    { id: 'target', labelKey: 'campaigns.columns.target' },
    { id: 'status', labelKey: 'campaigns.columns.status' },
    { id: 'results', labelKey: 'campaigns.columns.results' },
    { id: 'costPerResult', labelKey: 'campaigns.columns.costPerResult' },
    { id: 'budget', labelKey: 'campaigns.columns.budget' },
    { id: 'reach', labelKey: 'campaigns.columns.reach' },
    { id: 'impressions', labelKey: 'campaigns.columns.impressions' },
    { id: 'postEngagements', labelKey: 'campaigns.columns.postEngagements' },
    { id: 'clicks', labelKey: 'campaigns.columns.clicks' },
    { id: 'messagingContacts', labelKey: 'campaigns.columns.messagingContacts' },
    { id: 'amountSpent', labelKey: 'campaigns.columns.amountSpent' },
    { id: 'dailyBudget', labelKey: 'launch.dailyBudget' },
    { id: 'optimization', labelKey: 'campaigns.columns.optimization' },
    { id: 'bidAmount', labelKey: 'campaigns.columns.bidAmount' },
    { id: 'createdAt', labelKey: 'campaigns.columns.created' },
  ],
  ads: [
    { id: 'adAccount', labelKey: 'campaigns.columns.adAccount' },
    { id: 'page', labelKey: 'campaigns.columns.page' },
    { id: 'campaignName', labelKey: 'campaigns.columns.campaign' },
    { id: 'adSetName', labelKey: 'campaigns.columns.adSet' },
    { id: 'name', labelKey: 'campaigns.columns.adName' },
    { id: 'target', labelKey: 'campaigns.columns.target' },
    { id: 'status', labelKey: 'campaigns.columns.status' },
    { id: 'results', labelKey: 'campaigns.columns.results' },
    { id: 'costPerResult', labelKey: 'campaigns.columns.costPerResult' },
    { id: 'budget', labelKey: 'campaigns.columns.budget' },
    { id: 'reach', labelKey: 'campaigns.columns.reach' },
    { id: 'impressions', labelKey: 'campaigns.columns.impressions' },
    { id: 'postEngagements', labelKey: 'campaigns.columns.postEngagements' },
    { id: 'clicks', labelKey: 'campaigns.columns.clicks' },
    { id: 'messagingContacts', labelKey: 'campaigns.columns.messagingContacts' },
    { id: 'amountSpent', labelKey: 'campaigns.columns.amountSpent' },
    { id: 'title', labelKey: 'campaigns.columns.title' },
    { id: 'body', labelKey: 'campaigns.columns.body' },
    { id: 'createdAt', labelKey: 'campaigns.columns.created' },
  ],
};

const defaultVisibleSet = (tab: TabKey) => new Set(COLUMN_CONFIG[tab].map(c => c.id));

export default function CampaignsPage() {
  const { data: session } = useSession();
  const { selectedAccounts, adAccounts, refreshData } = useAdAccount();



  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { t, language } = useLanguage();

  // 1. Data State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Local Account Selection for this view (will load from localStorage after mount)
  const [viewSelectedAccountIds, setViewSelectedAccountIds] = useState<Set<string>>(new Set());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);


  // Initialize viewSelectedAccountIds with global selection when component mounts (optional, or start empty)
  // User requested: if no account selected at accounts tab (local), cannot go to other tabs.
  // We can default to empty or global. Let's default to empty to force explicit selection as per "like C:\Users... project" reference which often implies strict flow.
  // However, usually it's good UX to pre-select if we already have global.
  // Let's stick to: Start empty? No, better to sync with global initially?
  // User said: "Check box at accounts tab is not related to Config page".
  // This implies they start independent. Let's init with empty.
  // Wait, if users see everything empty they might be confused.
  // Let's initialize with ALL loaded accounts? Or Empty?
  // "If not select... cannot go". Implies empty start.

  // Sync View with Global Selection
  // Whenever global selectedAccounts changes, update the local view to match it exactly.
  // This ensures that if a user selects an account in Settings, it immediately appears here.
  // Sync View with Global Selection
  // Whenever global selectedAccounts changes, update the local view to match it exactly.
  // Exception: If URL has adAccountId, priority is given to URL until user manually changes something (handled by state).
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('adAccountId')) {
      if (selectedAccounts.length > 0) {
        setViewSelectedAccountIds(new Set(selectedAccounts.map(a => a.id)));
      } else {
        setViewSelectedAccountIds(new Set());
      }
    }
  }, [selectedAccounts]);

  /* Removed old complex localStorage intersection logic to prioritize "Settings as Source of Truth" */

  // Save selected accounts to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      localStorage.setItem('campaigns_selected_accounts', JSON.stringify(Array.from(viewSelectedAccountIds)));
    }
  }, [viewSelectedAccountIds, isMounted]);

  // 2. UI State — always init to 'campaigns' to avoid hydration mismatch; sync from URL after mount
  const [activeTab, setActiveTab] = useState<'campaigns' | 'adsets' | 'ads'>('campaigns');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed' | 'rejected' | 'with_issues' | 'in_review' | 'other'>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  // Load date range from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('campaigns_date_range');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.from && parsed.to) {
          setDateRange({
            from: new Date(parsed.from),
            to: new Date(parsed.to)
          });
        }
      } catch (e) {
        // Invalid data
      }
    }
  }, []);

  // Save date range to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && dateRange?.from && dateRange?.to) {
      localStorage.setItem('campaigns_date_range', JSON.stringify({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString()
      }));
    }
  }, [dateRange]);
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<Record<TabKey, Set<string>>>({
    campaigns: defaultVisibleSet('campaigns'),
    adsets: defaultVisibleSet('adsets'),
    ads: defaultVisibleSet('ads'),
  });
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false);
  const [editingBudgetCampaignId, setEditingBudgetCampaignId] = useState<string | null>(null);
  const [editingBudgetAdSetId, setEditingBudgetAdSetId] = useState<string | null>(null);
  const [editingBudgetAdId, setEditingBudgetAdId] = useState<string | null>(null);
  const [editingBudgetAdSource, setEditingBudgetAdSource] = useState<'campaign' | 'adset' | null>(null);
  const [budgetEditValue, setBudgetEditValue] = useState('');
  const [budgetEditType, setBudgetEditType] = useState<'daily' | 'lifetime'>('daily');
  const [budgetUpdating, setBudgetUpdating] = useState(false);

  useEffect(() => {
    if (!isMounted) return;
    try {
      const raw = localStorage.getItem('campaigns_visible_columns');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<TabKey, string[]>;
      const next: Record<TabKey, Set<string>> = {
        campaigns: new Set(parsed.campaigns ?? COLUMN_CONFIG.campaigns.map(c => c.id)),
        adsets: new Set(parsed.adsets ?? COLUMN_CONFIG.adsets.map(c => c.id)),
        ads: new Set(parsed.ads ?? COLUMN_CONFIG.ads.map(c => c.id)),
      };
      setVisibleColumns(next);
    } catch {
      /* ignore */
    }
  }, [isMounted]);

  const toggleColumn = useCallback((tab: TabKey, id: string) => {
    setVisibleColumns(prev => {
      const set = new Set(prev[tab]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const next = { ...prev, [tab]: set };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('campaigns_visible_columns', JSON.stringify({
            campaigns: Array.from(next.campaigns),
            adsets: Array.from(next.adsets),
            ads: Array.from(next.ads),
          }));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  const resetColumns = useCallback((tab: TabKey) => {
    const def = defaultVisibleSet(tab);
    setVisibleColumns(prev => {
      const next = { ...prev, [tab]: def };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('campaigns_visible_columns', JSON.stringify({
            campaigns: Array.from(next.campaigns),
            adsets: Array.from(next.adsets),
            ads: Array.from(next.ads),
          }));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  const visible = useCallback((tab: TabKey, id: string) => visibleColumns[tab].has(id), [visibleColumns]);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('campaigns_active_tab', activeTab);
    }
  }, [activeTab]);

  const handleTabChange = (tab: 'campaigns' | 'adsets' | 'ads') => {
    if (viewSelectedAccountIds.size === 0) {
      showWarningToast(t('campaigns.alert.selectAccount', 'Please select at least one account'));
      return;
    }
    setActiveTab(tab);
    // URL update handled by unified effect
  };

  // Auto-select accounts and switch tab when coming from launch page
  // Auto-select accounts and switch tab when coming from launch page or URL param
  // Unified URL State Management
  // 1. Initialize State from URL on Mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Accounts
    const acctsParam = params.get('adAccountId');
    if (acctsParam) {
      const ids = new Set(acctsParam.split(','));
      if (ids.size > 0) setViewSelectedAccountIds(ids);
    }

    // Dates
    const dateFrom = params.get('dateFrom');
    const dateTo = params.get('dateTo');
    if (dateFrom && dateTo) {
      setDateRange({ from: new Date(dateFrom), to: new Date(dateTo) });
    }

    // Status
    const statusParam = params.get('status');
    if (statusParam && ['all', 'active', 'paused', 'completed', 'rejected', 'with_issues', 'in_review'].includes(statusParam)) {
      setStatusFilter(statusParam as any);
    }

    // Tab — sync from URL on mount (avoids hydration mismatch; init is always 'campaigns')
    const tabParam = params.get('tab');
    if (tabParam && ['campaigns', 'adsets', 'ads'].includes(tabParam)) {
      setActiveTab(tabParam as 'campaigns' | 'adsets' | 'ads');
    } else {
      const saved = localStorage.getItem('campaigns_active_tab');
      if (saved && ['campaigns', 'adsets', 'ads'].includes(saved)) {
        setActiveTab(saved as 'campaigns' | 'adsets' | 'ads');
      }
    }
  }, []);

  // 2. Sync State to URL (Write)
  useEffect(() => {
    if (!isMounted) return;

    const params = new URLSearchParams(searchParams?.toString() || '');
    let hasChanges = false;

    // Tab
    if (activeTab && params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      hasChanges = true;
    }

    // Accounts
    if (viewSelectedAccountIds.size > 0) {
      const accountsStr = Array.from(viewSelectedAccountIds).join(',');
      if (params.get('adAccountId') !== accountsStr) {
        params.set('adAccountId', accountsStr);
        hasChanges = true;
      }
    } else {
      if (params.has('adAccountId')) {
        params.delete('adAccountId');
        hasChanges = true;
      }
    }

    // Dates
    if (dateRange?.from && dateRange?.to) {
      const fromStr = dateRange.from.toISOString();
      const toStr = dateRange.to.toISOString();
      if (params.get('dateFrom') !== fromStr || params.get('dateTo') !== toStr) {
        params.set('dateFrom', fromStr);
        params.set('dateTo', toStr);
        hasChanges = true;
      }
    }

    // Status
    if (statusFilter && statusFilter !== 'all') {
      if (params.get('status') !== statusFilter) {
        params.set('status', statusFilter);
        hasChanges = true;
      }
    } else {
      if (params.has('status')) {
        params.delete('status');
        hasChanges = true;
      }
    }

    if (hasChanges) {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [activeTab, viewSelectedAccountIds, dateRange, statusFilter, isMounted, pathname, router]);



  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  // 3. Selection State
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [selectedAdSetIds, setSelectedAdSetIds] = useState<Set<string>>(new Set());
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // 4. Filtered Data Logic (must be after state definitions)
  // 4. Filtered Data Logic (must be after state definitions)

  // Helper functions for detailed status
  // Extended interface for Account checking
  interface DetailedAdAccount {
    id: string;
    account_status?: number; // 1=Active, 2=Disabled, etc.
    disable_reason?: number;
    spend_cap?: string | number;
    amount_spent?: string | number;
  }

  // Type for status return
  type StatusResult = {
    label: string;
    color: string;
    textColor: string;
    type: 'active' | 'paused' | 'completed' | 'rejected' | 'with_issues' | 'in_review' | 'other';
  };

  // Helper functions for detailed status (Campaigns tab)
  const getCampaignStatus = (campaign: Campaign, accountMap: Record<string, DetailedAdAccount>): StatusResult => {
    // 1. Account Level Checks
    const account = campaign.adAccountId ? accountMap[campaign.adAccountId] : undefined;
    if (account) {
      if (account.account_status === 2) {
        return { label: t('status.campaigns.accountDisabled'), color: 'bg-red-500', textColor: 'text-red-600', type: 'rejected' };
      }
      const spendCap = Number(account.spend_cap);
      const amountSpent = Number(account.amount_spent);
      if (spendCap && spendCap > 0 && amountSpent >= spendCap) {
        return { label: t('status.campaigns.spendingLimitReached'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
      }
    }

    if (campaign.spendCap && campaign.spendCap > 0 && (campaign.amountSpent || 0) >= campaign.spendCap) {
      return { label: t('status.campaigns.spendingLimitReached'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
    }

    const status = campaign.effectiveStatus || campaign.status;

    if (status === 'ACTIVE' && campaign.adSets) {
      const allAds = campaign.adSets.flatMap(adSet => adSet.ads || []);
      if (allAds.some(ad => ad.effectiveStatus === 'DISAPPROVED')) {
        return { label: t('status.campaigns.rejected'), color: 'bg-red-500', textColor: 'text-red-600', type: 'rejected' };
      }
      if (allAds.some(ad => ad.effectiveStatus === 'WITH_ISSUES')) {
        return { label: t('status.campaigns.withIssues'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
      }
    }

    if (status === 'ACTIVE' && campaign.adSets && campaign.adSets.length > 0) {
      const allAdSetsManuallyOff = campaign.adSets.every(a => ['PAUSED', 'ARCHIVED', 'DELETED'].includes(a.effectiveStatus));
      if (allAdSetsManuallyOff) {
        return { label: t('status.campaigns.adSetsOff'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      }

      const allAds = campaign.adSets.flatMap(adSet => adSet.ads || []);
      if (allAds.length > 0) {
        const allAdsOff = allAds.every(ad =>
          ['PAUSED', 'ARCHIVED', 'DELETED'].includes(ad.effectiveStatus) ||
          (ad.effectiveStatus === 'CAMPAIGN_PAUSED' && status === 'ACTIVE')
        );
        if (allAdsOff) {
          return { label: t('status.campaigns.adsOff'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
        }
        const activeAdSets = campaign.adSets.filter(as => !['PAUSED', 'ARCHIVED', 'DELETED'].includes(as.effectiveStatus));
        if (activeAdSets.length > 0) {
          const adsInActiveSets = activeAdSets.flatMap(as => as.ads || []);
          if (adsInActiveSets.length > 0 && adsInActiveSets.every(ad => ['PAUSED', 'ARCHIVED', 'DELETED'].includes(ad.effectiveStatus))) {
            return { label: t('status.campaigns.adsOff'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
          }
        }
      } else {
        return { label: t('status.campaigns.noAds'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      }
    }

    switch (status) {
      case 'ACTIVE':
        return { label: t('status.campaigns.active'), color: 'bg-green-500', textColor: 'text-green-600', type: 'active' };
      case 'PAUSED':
        return { label: t('status.campaigns.off'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      case 'DELETED':
      case 'ARCHIVED':
        return { label: t('status.campaigns.completed'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'completed' };
      case 'Pending Settlement':
        return { label: t('status.campaigns.pendingSettlement'), color: 'bg-orange-500', textColor: 'text-orange-600', type: 'in_review' };
      case 'WITH_ISSUES':
        return { label: t('status.campaigns.withIssues'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
      case 'DISAPPROVED':
        return { label: t('status.campaigns.rejected'), color: 'bg-red-500', textColor: 'text-red-600', type: 'rejected' };
      case 'PENDING_REVIEW':
      case 'IN_PROCESS':
      case 'PREAPPROVAL':
      case 'PREAPPROVED':
        return { label: t('status.campaigns.inReview'), color: 'bg-blue-500', textColor: 'text-blue-600', type: 'in_review' };
      case 'CREDIT_CARD_NEEDED':
        return { label: t('status.creditCardNeeded'), color: 'bg-orange-500', textColor: 'text-orange-600', type: 'with_issues' };
      case 'PENDING_BILLING_INFO':
        return { label: t('status.pendingBillingInfo'), color: 'bg-orange-500', textColor: 'text-orange-600', type: 'with_issues' };
      case 'DISABLED':
      case 'PENDING_PROCESS':
        return { label: t('status.pendingProcess'), color: 'bg-amber-500', textColor: 'text-amber-600', type: 'in_review' };
      default:
        if (campaign.configuredStatus === 'PAUSED') {
          return { label: t('status.campaigns.off'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
        }
        return { label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' '), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'other' };
    }
  };


  // AdSets tab status
  const getAdSetStatus = (adSet: AdSet, accountMap: Record<string, DetailedAdAccount>): StatusResult => {
    const account = adSet.adAccountId ? accountMap[adSet.adAccountId] : undefined;
    if (account) {
      if (account.account_status === 2) {
        return { label: t('status.adsets.accountDisabled'), color: 'bg-red-500', textColor: 'text-red-600', type: 'rejected' };
      }
      const spendCap = Number(account.spend_cap);
      const amountSpent = Number(account.amount_spent);
      if (spendCap && spendCap > 0 && amountSpent >= spendCap) {
        return { label: t('status.adsets.spendingLimitReached'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
      }
    }

    const status = adSet.effectiveStatus || adSet.status;

    if (status === 'ACTIVE' && adSet.ads) {
      if (adSet.ads.some(ad => ad.effectiveStatus === 'DISAPPROVED')) {
        return { label: t('status.adsets.rejected'), color: 'bg-red-500', textColor: 'text-red-600', type: 'rejected' };
      }
      if (adSet.ads.some(ad => ad.effectiveStatus === 'WITH_ISSUES')) {
        return { label: t('status.adsets.withIssues'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
      }
    }

    if (status === 'ACTIVE' && adSet.ads && adSet.ads.length > 0) {
      const allAdsOff = adSet.ads.every(a => ['PAUSED', 'ARCHIVED', 'DELETED'].includes(a.effectiveStatus));
      if (allAdsOff) {
        return { label: t('status.adsets.adsOff'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      }
    }

    if (status === 'ACTIVE' && (!adSet.ads || adSet.ads.length === 0)) {
      return { label: t('status.adsets.noAds'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
    }

    switch (status) {
      case 'ACTIVE':
        return { label: t('status.adsets.active'), color: 'bg-green-500', textColor: 'text-green-600', type: 'active' };
      case 'PAUSED':
        return { label: t('status.adsets.off'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      case 'CAMPAIGN_PAUSED':
        return { label: t('status.adsets.campaignOff'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      case 'DELETED':
      case 'ARCHIVED':
        return { label: t('status.adsets.completed'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'completed' };
      case 'WITH_ISSUES':
        return { label: t('status.adsets.withIssues'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
      case 'DISAPPROVED':
        return { label: t('status.adsets.rejected'), color: 'bg-red-500', textColor: 'text-red-600', type: 'rejected' };
      case 'PENDING_REVIEW':
      case 'IN_PROCESS':
      case 'PREAPPROVAL':
      case 'PREAPPROVED':
        return { label: t('status.adsets.inReview'), color: 'bg-blue-500', textColor: 'text-blue-600', type: 'in_review' };
      case 'CREDIT_CARD_NEEDED':
        return { label: t('status.creditCardNeeded'), color: 'bg-orange-500', textColor: 'text-orange-600', type: 'with_issues' };
      case 'PENDING_BILLING_INFO':
        return { label: t('status.pendingBillingInfo'), color: 'bg-orange-500', textColor: 'text-orange-600', type: 'with_issues' };
      case 'DISABLED':
      case 'PENDING_PROCESS':
        return { label: t('status.pendingProcess'), color: 'bg-amber-500', textColor: 'text-amber-600', type: 'in_review' };
      default:
        if (adSet.configuredStatus === 'PAUSED') {
          return { label: t('status.adsets.off'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
        }
        return { label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' '), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'other' };
    }
  };

  // Ads tab status
  const getAdStatus = (ad: Ad, account?: DetailedAdAccount): StatusResult => {
    if (account) {
      if (account.account_status === 2 || account.disable_reason) {
        return { label: t('status.ads.accountDisabled'), color: 'bg-red-500', textColor: 'text-red-600', type: 'rejected' };
      }
      const spendCap = Number(account.spend_cap);
      const amountSpent = Number(account.amount_spent);
      if (spendCap && spendCap > 0 && amountSpent >= spendCap) {
        return { label: t('status.ads.spendingLimitReached'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
      }
    }
    const status = ad.effectiveStatus || ad.status;

    switch (status) {
      case 'ACTIVE':
        return { label: t('status.ads.active'), color: 'bg-green-500', textColor: 'text-green-600', type: 'active' };
      case 'PAUSED':
        return { label: t('status.ads.off'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      case 'ADSET_PAUSED':
        return { label: t('status.ads.adSetOff'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      case 'CAMPAIGN_PAUSED':
        return { label: t('status.ads.campaignOff'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
      case 'DISAPPROVED':
        return { label: t('status.ads.rejected'), color: 'bg-red-500', textColor: 'text-red-600', type: 'rejected' };
      case 'WITH_ISSUES':
        return { label: t('status.ads.withIssues'), color: 'bg-red-500', textColor: 'text-red-600', type: 'with_issues' };
      case 'DELETED':
      case 'ARCHIVED':
        return { label: t('status.ads.completed'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'completed' };
      case 'PENDING_REVIEW':
      case 'IN_PROCESS':
      case 'PREAPPROVAL':
      case 'PREAPPROVED':
        return { label: t('status.ads.inReview'), color: 'bg-blue-500', textColor: 'text-blue-600', type: 'in_review' };
      case 'CREDIT_CARD_NEEDED':
        return { label: t('status.creditCardNeeded'), color: 'bg-orange-500', textColor: 'text-orange-600', type: 'with_issues' };
      case 'PENDING_BILLING_INFO':
        return { label: t('status.pendingBillingInfo'), color: 'bg-orange-500', textColor: 'text-orange-600', type: 'with_issues' };
      case 'DISABLED':
      case 'PENDING_PROCESS':
        return { label: t('status.pendingProcess'), color: 'bg-amber-500', textColor: 'text-amber-600', type: 'in_review' };
      default:
        if (ad.configuredStatus === 'PAUSED') {
          return { label: t('status.ads.off'), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'paused' };
        }
        return { label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' '), color: 'bg-gray-400', textColor: 'text-gray-600', type: 'other' };
    }
  };

  // Helper functions for detailed status

  // Helper functions for detailed status

  // Create accountMap with useMemo
  const accountMap = useMemo(() => {
    return selectedAccounts.reduce((acc, curr) => {
      acc[curr.id] = curr;
      return acc;
    }, {} as Record<string, DetailedAdAccount>);
  }, [selectedAccounts]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      // ... existing filter logic
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || getCampaignStatus(c, accountMap).type === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;

      const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

      if (sortConfig.key === 'status') {
        const statusA = getCampaignStatus(a, accountMap).label;
        const statusB = getCampaignStatus(b, accountMap).label;
        return statusA.localeCompare(statusB) * directionMultiplier;
      }

      const valA = a[sortConfig.key as keyof Campaign];
      const valB = b[sortConfig.key as keyof Campaign];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * directionMultiplier;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * directionMultiplier;
      }
      return 0;
    });
  }, [campaigns, searchQuery, statusFilter, accountMap, sortConfig]);

  const filteredAdSets = useMemo(() => {
    if (activeTab !== 'adsets') return []; // Performance optimization

    return adSets.filter(adSet => {
      // ... existing filter logic ...
      // Campaign filter (if campaigns are selected, show only their adsets)
      if (selectedCampaignIds.size > 0 && !selectedCampaignIds.has(adSet.campaignId)) {
        return false;
      }

      // Search & Status
      const matchesSearch = adSet.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || getAdSetStatus(adSet, accountMap).type === statusFilter;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;

      const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

      if (sortConfig.key === 'status') {
        const statusA = getAdSetStatus(a, accountMap).label;
        const statusB = getAdSetStatus(b, accountMap).label;
        return statusA.localeCompare(statusB) * directionMultiplier;
      }

      const valA = a[sortConfig.key as keyof AdSet];
      const valB = b[sortConfig.key as keyof AdSet];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * directionMultiplier;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * directionMultiplier;
      }
      return 0;
    });
  }, [activeTab, adSets, selectedCampaignIds, searchQuery, statusFilter, accountMap, sortConfig]);

  // ... (DetailedAdAccount interface remains same)

  // ... (getCampaignStatus remains same)



  const filteredAds = useMemo(() => {
    if (activeTab !== 'ads') return []; // Performance optimization

    return ads.filter(ad => {
      // AdSet filter (if adsets are selected, show only their ads)
      if (selectedAdSetIds.size > 0) {
        if (!selectedAdSetIds.has(ad.adsetId)) return false;
      }
      // Fallback: Campaign filter (if campaigns are selected, show only their ads)
      else if (selectedCampaignIds.size > 0) {
        if (!selectedCampaignIds.has(ad.campaignId)) return false;
      }

      // Search & Status (Basic logic, can be refined to search body/title too)
      const matchesSearch = ad.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ad.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ad.body?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || getAdStatus(ad, accountMap[ad.adAccountId || '']).type === statusFilter;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;

      const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

      if (sortConfig.key === 'status') {
        const statusA = getAdStatus(a, accountMap[a.adAccountId || '']).label;
        const statusB = getAdStatus(b, accountMap[b.adAccountId || '']).label;
        return statusA.localeCompare(statusB) * directionMultiplier;
      }

      const valA = a[sortConfig.key as keyof Ad];
      const valB = b[sortConfig.key as keyof Ad];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * directionMultiplier;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * directionMultiplier;
      }
      return 0;
    });
  }, [activeTab, ads, selectedAdSetIds, selectedCampaignIds, searchQuery, statusFilter, accountMap, sortConfig]);












  // 4. Sorting Handlers
  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key: null, direction: null };
    });
  };

  // Sortable Header Component using Shadcn TableHead
  const SortableHeader = ({
    columnKey,
    label,
    align = 'left',
    className = ''
  }: {
    columnKey: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    className?: string;
  }) => {
    const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : '';
    const textAlignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

    return (
      <TableHead
        className={cn(textAlignClass, 'cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors', className)}
        onClick={() => handleSort(columnKey)}
      >
        <div className={cn('flex items-center gap-1', justifyClass)}>
          {label}
          {sortConfig.key === columnKey && sortConfig.direction === 'asc' && <ArrowUp className="h-3 w-3" />}
          {sortConfig.key === columnKey && sortConfig.direction === 'desc' && <ArrowDown className="h-3 w-3" />}
          {sortConfig.key !== columnKey && <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </div>
      </TableHead>
    );
  };

  // Generic sort function
  const sortData = <T extends Record<string, any>>(data: T[]): T[] => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key!];
      const bVal = b[sortConfig.key!];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compare values
      if (aVal === bVal) return 0;
      const comparison = aVal > bVal ? 1 : -1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  // 5. Selection Handlers
  const handleToggleCampaignSelection = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedCampaignIds);
    if (checked) newSelected.add(id); else newSelected.delete(id);
    setSelectedCampaignIds(newSelected);
  };

  const handleToggleAllCampaigns = (checked: boolean) => {
    if (checked) {
      setSelectedCampaignIds(new Set(filteredCampaigns.map(c => c.id)));
    } else {
      setSelectedCampaignIds(new Set());
    }
  };

  const handleToggleAdSetSelection = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedAdSetIds);
    if (checked) newSelected.add(id); else newSelected.delete(id);
    setSelectedAdSetIds(newSelected);
  };

  const handleToggleAllAdSets = (checked: boolean) => {
    if (checked) {
      setSelectedAdSetIds(new Set(filteredAdSets.map(a => a.id)));
    } else {
      setSelectedAdSetIds(new Set());
    }
  };

  const handleToggleAdSelection = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedAdIds);
    if (checked) newSelected.add(id); else newSelected.delete(id);
    setSelectedAdIds(newSelected);
  };

  const handleToggleAllAds = (checked: boolean) => {
    if (checked) {
      setSelectedAdIds(new Set(filteredAds.map(a => a.id)));
    } else {
      setSelectedAdIds(new Set());
    }
  };

  // Track last fetched accounts/date to prevent unnecessary API calls
  const lastFetchedAccountsRef = useRef<string>('');
  const lastFetchedDateRangeRef = useRef<string>('');
  const isFetchingRef = useRef(false);
  const lastManualRefreshRef = useRef<number>(0);
  const REFRESH_COOLDOWN = 5 * 60 * 1000; // 5 minutes - prevent unnecessary API calls when user clicks Refresh repeatedly

  // Prefetch all tabs in parallel for instant tab switching (must be defined before useEffects that use it)
  const fetchAllTabsInParallel = useCallback(async (forceRefresh = false, silent = false) => {
    const targetIds = Array.from(viewSelectedAccountIds);
    if (targetIds.length === 0) return;

    const adAccountIds = targetIds.join(',');
    const baseParams = (path: string) => {
      let url = `${path}?adAccountId=${adAccountIds}`;
      if (dateRange?.from && dateRange?.to) {
        url += `&dateFrom=${dateRange.from.toISOString()}&dateTo=${dateRange.to.toISOString()}`;
      }
      if (statusFilter && statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (forceRefresh) url += '&refresh=true';
      return url;
    };

    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const [campRes, adSetRes, adRes] = await Promise.all([
        fetch(baseParams('/api/campaigns')),
        fetch(baseParams('/api/adsets')),
        fetch(baseParams('/api/ads')),
      ]);

      const campData = await campRes.json().catch(() => ({}));
      const adSetData = await adSetRes.json().catch(() => ({}));
      const adData = await adRes.json().catch(() => ({}));

      if (campRes.ok) {
        const formatted = (campData.campaigns || []).map((c: any) => ({
          ...c,
          createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-',
          spend: c.metrics?.spend || 0,
          messages: c.metrics?.messages || 0,
          costPerMessage: c.metrics?.costPerMessage || 0,
          results: c.metrics?.results || 0,
          costPerResult: c.metrics?.costPerResult || 0,
          budget: c.metrics?.budget || 0,
          reach: c.metrics?.reach || 0,
          impressions: c.metrics?.impressions || 0,
          postEngagements: c.metrics?.postEngagements || 0,
          clicks: c.metrics?.clicks || 0,
          messagingContacts: c.metrics?.messagingContacts || 0,
          amountSpent: c.metrics?.amountSpent || 0,
          effectiveStatus: c.effectiveStatus,
          configuredStatus: c.configuredStatus,
          spendCap: c.spendCap,
          issuesInfo: c.issuesInfo,
          adSets: c.adSets || [],
        }));
        setCampaigns(formatted);
      }

      if (adSetRes.ok) {
        const formatted = (adSetData.adsets || []).map((a: any) => ({
          ...a,
          createdAt: a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-',
          spend: a.metrics?.spend || 0,
          messages: a.metrics?.messages || 0,
          costPerMessage: a.metrics?.costPerMessage || 0,
          results: a.metrics?.results || 0,
          costPerResult: a.metrics?.costPerResult || 0,
          budget: (a.dailyBudget > 0 ? a.dailyBudget : a.lifetimeBudget) || 0,
          reach: a.metrics?.reach || 0,
          impressions: a.metrics?.impressions || 0,
          postEngagements: a.metrics?.postEngagements || 0,
          clicks: a.metrics?.clicks || 0,
          messagingContacts: a.metrics?.messagingContacts || 0,
          amountSpent: a.metrics?.amountSpent || 0,
          effectiveStatus: a.effectiveStatus,
          configuredStatus: a.configuredStatus,
          issuesInfo: a.issuesInfo,
          ads: a.ads || [],
        }));
        setAdSets(formatted);
      }

      if (adRes.ok) {
        const formatted = (adData.ads || []).map((ad: any) => ({
          ...ad,
          createdAt: new Date(ad.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          postLink: ad.postLink,
          amountSpent: ad.metrics?.amountSpent || 0,
          results: ad.metrics?.results || 0,
          costPerResult: ad.metrics?.costPerResult || 0,
          budget: ad.budget || 0,
          budgetSource: ad.budgetSource,
          budgetType: ad.budgetType,
          campaignDailyBudget: ad.campaignDailyBudget,
          campaignLifetimeBudget: ad.campaignLifetimeBudget,
          adsetDailyBudget: ad.adsetDailyBudget,
          adsetLifetimeBudget: ad.adsetLifetimeBudget,
          reach: ad.metrics?.reach || 0,
          impressions: ad.metrics?.impressions || 0,
          postEngagements: ad.metrics?.postEngagements || 0,
          clicks: ad.metrics?.clicks || 0,
          messagingContacts: ad.metrics?.messagingContacts || 0,
          effectiveStatus: ad.effectiveStatus,
          configuredStatus: ad.configuredStatus,
          issuesInfo: ad.issuesInfo,
        }));
        setAds(formatted);
      }

      if (!silent) {
        if (!campRes.ok) setError(campData.error || 'Failed to fetch campaigns');
        else if (!adSetRes.ok) setError(adSetData.error || 'Failed to fetch ad sets');
        else if (!adRes.ok) setError(adData.error || 'Failed to fetch ads');
      }
    } catch (err) {
      console.error('Error fetching campaigns data:', err);
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [viewSelectedAccountIds, dateRange, statusFilter]);

  const handleRefreshClick = useCallback(async () => {
    const now = Date.now();
    const useCacheDueToCooldown = lastManualRefreshRef.current > 0 && (now - lastManualRefreshRef.current < REFRESH_COOLDOWN);
    if (!useCacheDueToCooldown) lastManualRefreshRef.current = now;
    await fetchAllTabsInParallel(!useCacheDueToCooldown);
  }, [fetchAllTabsInParallel]);

  // Check for refresh param on mount
  const shouldForceRefresh = searchParams?.get('refresh') === 'true';

  useEffect(() => {
    // Only fetch if we have a session.
    // NOTE: fetching Logic depends on TABS.
    // If Tab is Campaigns/AdSets/Ads, it depends on viewSelectedAccountIds
    if (!session?.user || isFetchingRef.current) return;

    // For Accounts tab, we don't fetch campaigns data here (AccountsTab component handles it).
    // We only fetch for the other tabs.


    // If no accounts are configured globally, clear data
    if (selectedAccounts.length === 0) {
      setCampaigns([]);
      setAdSets([]);
      setAds([]);
      setLoading(false);
      return;
    }

    // If local selection is empty (None Selected), don't fetch anything.
    if (viewSelectedAccountIds.size === 0) {
      setCampaigns([]);
      setAdSets([]);
      setAds([]);
      setLoading(false);
      return;
    }

    // Check if accounts OR date range changed (tab change doesn't refetch - we prefetch all)
    const currentAccountIds = Array.from(viewSelectedAccountIds).sort().join(',');
    const currentDateRangeString = dateRange?.from && dateRange?.to
      ? `${dateRange.from.toISOString()}_${dateRange.to.toISOString()}`
      : 'all';

    const accountsChanged = lastFetchedAccountsRef.current !== currentAccountIds;
    const dateChanged = lastFetchedDateRangeRef.current !== currentDateRangeString;

    const hasChanged = accountsChanged || dateChanged;

    if (!hasChanged && !shouldForceRefresh) {
      return;
    }

    lastFetchedAccountsRef.current = currentAccountIds;
    lastFetchedDateRangeRef.current = currentDateRangeString;

    // Prefetch all tabs in parallel for instant tab switching
    const fetchData = async () => {
      const refreshParam = shouldForceRefresh || dateChanged;
      await fetchAllTabsInParallel(refreshParam);
      if (refreshParam) lastManualRefreshRef.current = Date.now();

      if (shouldForceRefresh) {
        const url = new URL(window.location.href);
        url.searchParams.delete('refresh');
        window.history.replaceState({}, '', url.toString());
      }
    };

    fetchData();
  }, [session, viewSelectedAccountIds, dateRange, shouldForceRefresh, fetchAllTabsInParallel]);





  // Polling for real-time updates every 15 seconds
  useEffect(() => {
    if (!session?.user || selectedAccounts.length === 0) return;

    const pollInterval = setInterval(() => {
      if (document.hidden) return;
      fetchAllTabsInParallel(false, true);
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [session, selectedAccounts, dateRange, fetchAllTabsInParallel]);

  const fetchCampaigns = async (forceRefresh = false, silent = false) => {
    if (isFetchingRef.current) return; // Prevent concurrent requests

    try {
      isFetchingRef.current = true;
      if (!silent) setLoading(true);

      // Fetch campaigns from all selected accounts in one go
      // Fetch campaigns from specific selected accounts
      // If none selected locally, we already returned early above.
      const targetIds = Array.from(viewSelectedAccountIds);

      if (targetIds.length === 0) {
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      const adAccountIds = targetIds.join(',');

      // Build URL with date range
      let url = `/api/campaigns?adAccountId=${adAccountIds}`;
      if (dateRange?.from && dateRange?.to) {
        url += `&dateFrom=${dateRange.from.toISOString()}&dateTo=${dateRange.to.toISOString()}`;
      }

      // Add status filter
      if (statusFilter && statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }

      if (forceRefresh) {
        url += '&refresh=true';
      }

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();

        const formattedCampaigns = (data.campaigns || []).map((c: any) => ({
          ...c,
          createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-',
          spend: c.metrics?.spend || 0,
          messages: c.metrics?.messages || 0,
          costPerMessage: c.metrics?.costPerMessage || 0,
          results: c.metrics?.results || 0,
          costPerResult: c.metrics?.costPerResult || 0,
          budget: c.metrics?.budget || 0,
          reach: c.metrics?.reach || 0,
          impressions: c.metrics?.impressions || 0,
          postEngagements: c.metrics?.postEngagements || 0,
          clicks: c.metrics?.clicks || 0,
          messagingContacts: c.metrics?.messagingContacts || 0,
          amountSpent: c.metrics?.amountSpent || 0,
          effectiveStatus: c.effectiveStatus,
          configuredStatus: c.configuredStatus,
          spendCap: c.spendCap,
          issuesInfo: c.issuesInfo,
          adSets: c.adSets || [],
        }));

        setCampaigns(formattedCampaigns);
      } else {
        const data = await response.json();
        if (!silent) setError(data.error || 'Failed to fetch campaigns');
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      if (!silent) setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const fetchAdSets = async (forceRefresh = false, silent = false) => {
    if (isFetchingRef.current) return; // Prevent concurrent requests

    try {
      isFetchingRef.current = true;
      if (!silent) setLoading(true);

      const targetIds = Array.from(viewSelectedAccountIds);

      if (targetIds.length === 0) {
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      const adAccountIds = targetIds.join(',');

      // Build URL with date range
      let url = `/api/adsets?adAccountId=${adAccountIds}`;
      if (dateRange?.from && dateRange?.to) {
        url += `&dateFrom=${dateRange.from.toISOString()}&dateTo=${dateRange.to.toISOString()}`;
      }

      // Add status filter
      if (statusFilter && statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }

      if (forceRefresh) {
        url += '&refresh=true';
      }

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();

        const formattedAdSets = (data.adsets || []).map((a: any) => ({
          ...a,
          createdAt: a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-',
          // Ensure metrics exist with defaults
          spend: a.metrics?.spend || 0,
          messages: a.metrics?.messages || 0,
          costPerMessage: a.metrics?.costPerMessage || 0,
          results: a.metrics?.results || 0,
          costPerResult: a.metrics?.costPerResult || 0,
          budget: a.metrics?.budget || 0,
          reach: a.metrics?.reach || 0,
          impressions: a.metrics?.impressions || 0,
          postEngagements: a.metrics?.postEngagements || 0,
          clicks: a.metrics?.clicks || 0,
          messagingContacts: a.metrics?.messagingContacts || 0,
          amountSpent: a.metrics?.amountSpent || 0,
          effectiveStatus: a.effectiveStatus,
          configuredStatus: a.configuredStatus,
          issuesInfo: a.issuesInfo,
          ads: a.ads || [],
        }));

        setAdSets(formattedAdSets);
      } else {
        const data = await response.json();
        if (!silent) setError(data.error || 'Failed to fetch ad sets');
      }
    } catch (err) {
      console.error('Error fetching ad sets:', err);
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load ad sets');
    } finally {
      if (!silent) setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const fetchAds = async (forceRefresh = false, silent = false) => {
    if (isFetchingRef.current) return; // Prevent concurrent requests

    try {
      isFetchingRef.current = true;
      if (!silent) setLoading(true);

      const targetIds = Array.from(viewSelectedAccountIds);

      if (targetIds.length === 0) {
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      const adAccountIds = targetIds.join(',');

      // Build URL with date range
      let url = `/api/ads?adAccountId=${adAccountIds}`;
      if (dateRange?.from && dateRange?.to) {
        url += `&dateFrom=${dateRange.from.toISOString()}&dateTo=${dateRange.to.toISOString()}`;
      }

      // Add status filter
      if (statusFilter && statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }

      if (forceRefresh) {
        url += '&refresh=true';
      }

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();

        const formattedAds = (data.ads || []).map((ad: any) => ({
          ...ad,
          createdAt: new Date(ad.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          postLink: ad.postLink,
          amountSpent: ad.metrics?.amountSpent || 0,
          results: ad.metrics?.results || 0,
          costPerResult: ad.metrics?.costPerResult || 0,
          budget: ad.budget || 0,
          budgetSource: ad.budgetSource,
          budgetType: ad.budgetType,
          campaignDailyBudget: ad.campaignDailyBudget,
          campaignLifetimeBudget: ad.campaignLifetimeBudget,
          adsetDailyBudget: ad.adsetDailyBudget,
          adsetLifetimeBudget: ad.adsetLifetimeBudget,
          reach: ad.metrics?.reach || 0,
          impressions: ad.metrics?.impressions || 0,
          postEngagements: ad.metrics?.postEngagements || 0,
          clicks: ad.metrics?.clicks || 0,
          messagingContacts: ad.metrics?.messagingContacts || 0,
          effectiveStatus: ad.effectiveStatus,
          configuredStatus: ad.configuredStatus,
          issuesInfo: ad.issuesInfo,
        }));
        setAds(formattedAds);
      } else {
        const data = await response.json();
        if (!silent) setError(data.error || 'Failed to fetch ads');
      }
    } catch (err) {
      console.error('Error fetching ads:', err);
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load ads');
    } finally {
      if (!silent) setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleToggleCampaign = async (campaignId: string, currentStatus: string) => {
    // Optimistic update
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setCampaigns(prev =>
      prev.map(c => c.id === campaignId ? { ...c, status: newStatus } : c)
    );

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/toggle`, {
        method: 'POST',
      });

      if (response.ok) {
        lastManualRefreshRef.current = Date.now();
        fetchAllTabsInParallel(true, true);
      } else {
        // Revert on error
        setCampaigns(prev =>
          prev.map(c => c.id === campaignId ? { ...c, status: currentStatus } : c)
        );
        const error = await response.json();
        showErrorToast(error.error || t('campaigns.error.toggle', 'Failed to toggle campaign status'));
      }
    } catch (error) {
      // Revert on error
      setCampaigns(prev =>
        prev.map(c => c.id === campaignId ? { ...c, status: currentStatus } : c)
      );
      console.error('Error toggling campaign:', error);
      showErrorToast(t('campaigns.error.toggle', 'Failed to toggle campaign status'));
    }
  };

  const handleToggleAdSet = async (adSetId: string, currentStatus: string) => {
    // Optimistic update
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setAdSets(prev =>
      prev.map(a => a.id === adSetId ? { ...a, status: newStatus } : a)
    );

    try {
      const response = await fetch(`/api/adsets/${adSetId}/toggle`, {
        method: 'POST',
      });

      if (response.ok) {
        lastManualRefreshRef.current = Date.now();
        fetchAllTabsInParallel(true, true);
      } else {
        // Revert on error
        setAdSets(prev =>
          prev.map(a => a.id === adSetId ? { ...a, status: currentStatus } : a)
        );
        const error = await response.json();
        showErrorToast(error.error || 'Failed to toggle ad set status');
      }
    } catch (error) {
      // Revert on error
      setAdSets(prev =>
        prev.map(a => a.id === adSetId ? { ...a, status: currentStatus } : a)
      );
      console.error('Error toggling ad set:', error);
      showErrorToast('Failed to toggle ad set status');
    }
  };

  const handleToggleAd = async (adId: string, currentStatus: string) => {
    // Optimistic update
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setAds(prev =>
      prev.map(a => a.id === adId ? { ...a, status: newStatus } : a)
    );

    try {
      const response = await fetch(`/api/ads/${adId}/toggle`, {
        method: 'POST',
      });

      if (response.ok) {
        lastManualRefreshRef.current = Date.now();
        fetchAllTabsInParallel(true, true);
      } else {
        // Revert on error
        setAds(prev =>
          prev.map(a => a.id === adId ? { ...a, status: currentStatus } : a)
        );
        const error = await response.json();
        showErrorToast(error.error || 'Failed to toggle ad status');
      }
    } catch (error) {
      // Revert on error
      setAds(prev =>
        prev.map(a => a.id === adId ? { ...a, status: currentStatus } : a)
      );
      console.error('Error toggling ad:', error);
      showErrorToast('Failed to toggle ad status');
    }
  };

  // Helper function to get ad account name from ID
  const getAdAccountName = (adAccountId?: string) => {
    if (!adAccountId) return '-';
    const account = selectedAccounts.find(acc => acc.id === adAccountId);
    return account ? account.name : adAccountId.replace('act_', '');
  };

  // Helper function to get full ad account ID for Meta links
  const getAdAccountIdForMeta = (adAccountId?: string) => {
    if (!adAccountId) return '';
    const account = selectedAccounts.find(acc => acc.id === adAccountId);
    return account ? account.account_id : adAccountId;
  };

  // Helper function to format currency (uses formatCurrencyByCode for correct symbol & decimal places per currency)
  const formatCurrency = (amount: number, currency?: string) => {
    return formatCurrencyByCode(amount, currency || 'USD');
  };

  const handleUpdateCampaignBudget = async (campaignId: string, adAccountId: string, currency: string, fromAd = false) => {
    const num = parseFloat(budgetEditValue);
    if (isNaN(num) || num <= 0) {
      showErrorToast(t('campaigns.budget.invalidAmount', 'Please enter a valid positive amount'));
      return;
    }
    setBudgetUpdating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId,
          currency: currency || 'USD',
          ...(budgetEditType === 'daily' ? { dailyBudget: num } : { lifetimeBudget: num }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update budget');
      showCustomToast(t('campaigns.budget.updated', 'Budget updated successfully'), { type: 'success' });
      setEditingBudgetCampaignId(null);
      setBudgetEditValue('');
      if (fromAd) {
        setEditingBudgetAdId(null);
        setEditingBudgetAdSource(null);
      }
      setCampaigns(prev => prev.map(c => {
        if (c.id !== campaignId) return c;
        return {
          ...c,
          dailyBudget: budgetEditType === 'daily' ? num : 0,
          lifetimeBudget: budgetEditType === 'lifetime' ? num : 0,
        };
      }));
      await refreshData(true, { bypassCooldown: true });
      await fetchAllTabsInParallel(true, true);
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : t('campaigns.budget.updateFailed', 'Failed to update budget'));
    } finally {
      setBudgetUpdating(false);
    }
  };

  const handleUpdateAdSetBudget = async (adSetId: string, adAccountId: string, currency: string, fromAd = false) => {
    const num = parseFloat(budgetEditValue);
    if (isNaN(num) || num <= 0) {
      showErrorToast(t('campaigns.budget.invalidAmount', 'Please enter a valid positive amount'));
      return;
    }
    setBudgetUpdating(true);
    try {
      const res = await fetch(`/api/adsets/${adSetId}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId,
          currency: currency || 'USD',
          ...(budgetEditType === 'daily' ? { dailyBudget: num } : { lifetimeBudget: num }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update budget');
      showCustomToast(t('campaigns.budget.updated', 'Budget updated successfully'), { type: 'success' });
      setEditingBudgetAdSetId(null);
      setBudgetEditValue('');
      if (fromAd) {
        setEditingBudgetAdId(null);
        setEditingBudgetAdSource(null);
      }
      setAdSets(prev => prev.map(a => {
        if (a.id !== adSetId) return a;
        return {
          ...a,
          dailyBudget: budgetEditType === 'daily' ? num : 0,
          lifetimeBudget: budgetEditType === 'lifetime' ? num : 0,
        };
      }));
      await refreshData(true, { bypassCooldown: true });
      await fetchAllTabsInParallel(true, true);
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : t('campaigns.budget.updateFailed', 'Failed to update budget'));
    } finally {
      setBudgetUpdating(false);
    }
  };

  // Helper function to format targeting data
  const formatTargeting = (targeting: any) => {
    if (!targeting) return '-';

    const parts = [];

    // Age
    if (targeting.age_min || targeting.age_max) {
      const ageMin = targeting.age_min || '18';
      const ageMax = targeting.age_max || t('campaigns.targeting.noLimit', '65+');
      parts.push(`${t('campaigns.targeting.age', 'Age')}: ${ageMin}-${ageMax}`);
    }

    // Countries
    if (targeting.geo_locations?.countries && targeting.geo_locations.countries.length > 0) {
      const countries = targeting.geo_locations.countries.join(', ');
      parts.push(`${t('campaigns.targeting.country', 'Country')}: ${countries}`);
    }

    // Interests
    if (targeting.flexible_spec && targeting.flexible_spec.length > 0) {
      const interests: string[] = [];
      targeting.flexible_spec.forEach((spec: any) => {
        if (spec.interests) {
          spec.interests.forEach((interest: any) => {
            if (interest.name) interests.push(interest.name);
          });
        }
      });
      if (interests.length > 0) {
        parts.push(`${t('campaigns.targeting.interests', 'Interests')}: ${interests.slice(0, 3).join(', ')}${interests.length > 3 ? '...' : ''}`);
      }
    }

    return parts.length > 0 ? parts.join('\n') : '-';
  };

  // Helper function to format targeting data (full version for popover)
  const formatTargetingFull = (targeting: any) => {
    if (!targeting) return '-';

    const parts = [];

    // Age
    if (targeting.age_min || targeting.age_max) {
      const ageMin = targeting.age_min || '18';
      const ageMax = targeting.age_max || t('campaigns.targeting.noLimit', '65+');
      parts.push(`${t('campaigns.targeting.age', 'Age')}: ${ageMin}-${ageMax}`);
    }

    // Countries
    if (targeting.geo_locations?.countries && targeting.geo_locations.countries.length > 0) {
      const countries = targeting.geo_locations.countries.join(', ');
      parts.push(`${t('campaigns.targeting.country', 'Country')}: ${countries}`);
    }

    // Interests (all interests, not limited to 3)
    if (targeting.flexible_spec && targeting.flexible_spec.length > 0) {
      const interests: string[] = [];
      targeting.flexible_spec.forEach((spec: any) => {
        if (spec.interests) {
          spec.interests.forEach((interest: any) => {
            if (interest.name) interests.push(interest.name);
          });
        }
      });
      if (interests.length > 0) {
        parts.push(`${t('campaigns.targeting.interests', 'Interests')}: ${interests.join(', ')}`);
      }
    }

    return parts.length > 0 ? parts.join('\n') : '-';
  };

  const handleCreateCampaign = () => {
    // TODO: Implement create campaign logic
    console.log('Create campaign');
  };

  return (
    <div className="h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] p-4 md:p-6 lg:p-8 flex flex-col overflow-hidden">
      <div className="w-full flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('campaigns.title', 'All Campaigns')}</h1>
            <p className="text-gray-600 dark:text-gray-400">{t('campaigns.subtitle', 'Manage and optimize your campaigns')}</p>
          </div>


          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[250px] justify-between bg-white dark:bg-zinc-950">
                  <div className="flex items-center gap-2 truncate">
                    <span>
                      {!isMounted ? t('campaigns.selectAccount', 'Select Account') : (
                        viewSelectedAccountIds.size === selectedAccounts.length
                          ? t('campaigns.allAccounts', 'All Accounts')
                          : viewSelectedAccountIds.size === 0
                            ? t('campaigns.selectAccount', 'Select Account')
                            : `${viewSelectedAccountIds.size} ${t('common.selected', 'Selected')}`
                      )}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 rounded-xl" align="start">
                <div className="p-2 border-b">
                  <div
                    className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-sm cursor-pointer"
                    onClick={(e) => {
                      // Prevent double toggle if clicking directly on the checkbox
                      if ((e.target as HTMLElement).getAttribute('role') === 'checkbox') return;

                      const isChecked = selectedAccounts.length > 0 && viewSelectedAccountIds.size === selectedAccounts.length;
                      if (!isChecked) {
                        // Select All
                        setViewSelectedAccountIds(new Set(selectedAccounts.map(a => a.id)));
                      } else {
                        // Deselect All (None)
                        setViewSelectedAccountIds(new Set());
                      }
                    }}
                  >
                    <Checkbox
                      id="select-all"
                      checked={selectedAccounts.length > 0 && viewSelectedAccountIds.size === selectedAccounts.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          // Select All
                          setViewSelectedAccountIds(new Set(selectedAccounts.map(a => a.id)));
                        } else {
                          // Deselect All (None)
                          setViewSelectedAccountIds(new Set());
                        }
                      }}
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('campaigns.allAccounts', 'All Accounts')}
                    </label>
                  </div>
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2">
                    {selectedAccounts.length === 0 ? (
                      <div className="p-2 text-sm text-center text-muted-foreground">
                        {t('campaigns.noConfiguredAccounts', 'No accounts configured in Settings')}
                      </div>
                    ) : (
                      selectedAccounts.map((account) => {
                        const isChecked = viewSelectedAccountIds.has(account.id);

                        return (
                          <div
                            key={account.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-sm cursor-pointer"
                            onClick={(e) => {
                              // Prevent double toggle if clicking directly on the checkbox
                              if ((e.target as HTMLElement).getAttribute('role') === 'checkbox') return;

                              let newSet = new Set(viewSelectedAccountIds);
                              if (!isChecked) {
                                newSet.add(account.id);
                              } else {
                                newSet.delete(account.id);
                              }
                              setViewSelectedAccountIds(newSet);
                            }}
                          >
                            <Checkbox
                              id={`account-${account.id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                let newSet = new Set(viewSelectedAccountIds);
                                if (checked) {
                                  newSet.add(account.id);
                                } else {
                                  newSet.delete(account.id);
                                }
                                setViewSelectedAccountIds(newSet);
                              }}
                            />
                            <div className="flex flex-col flex-1 truncate">
                              <label
                                htmlFor={`account-${account.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-gray-900 dark:text-gray-100"
                              >
                                {account.name}
                              </label>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                ID: {account.account_id}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button onClick={handleCreateCampaign} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              {t('campaigns.newCampaign', 'New Campaign')}
            </Button>
          </div>


        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('campaigns.search', 'Search campaigns...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
          </div>

          {/* Date Range Picker */}
          <DatePickerWithRange
            date={dateRange}
            setDate={setDateRange}
          />

          {/* Filter by Status */}
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as any)}
          >
            <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-950 rounded-lg">
              <SelectValue placeholder={t('campaigns.filter.allStatus', 'All Status')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">{t('campaigns.filter.allStatus', 'All Status')}</SelectItem>
              <SelectItem value="active">{t('campaigns.filter.active', 'Active')}</SelectItem>
              <SelectItem value="paused">{t('campaigns.filter.paused', 'Paused')}</SelectItem>
              <SelectItem value="completed">{t('campaigns.filter.completed', 'Completed')}</SelectItem>
              <SelectItem value="rejected">{t('campaigns.filter.rejected', 'Rejected')}</SelectItem>
              <SelectItem value="with_issues">{t('campaigns.filter.withIssues', 'With Issues')}</SelectItem>
              <SelectItem value="in_review">{t('campaigns.filter.inReview', 'In Review')}</SelectItem>
              <SelectItem value="other">{t('campaigns.filter.other', 'Other')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            onClick={handleRefreshClick}
            variant="outline"
            size="sm"
            className="gap-2 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {t('common.refresh', 'Refresh')}
          </Button>

          {/* Export Button */}
          <Button
            onClick={() => setExportDialogOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <Download className="h-4 w-4 mr-1" />
            {t('common.export', 'Export')}
          </Button>

          {/* Customize Columns */}
          <Popover open={columnsPopoverOpen} onOpenChange={setColumnsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900"
              >
                <Columns2 className="h-4 w-4" />
                {t('campaigns.toolbar.columns', 'Columns')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 rounded-xl" align="end">
              <div className="p-3 border-b border-gray-200 dark:border-zinc-800">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('campaigns.toolbar.customizeColumns', 'Show / hide columns')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {activeTab === 'campaigns' && t('campaigns.tabs.campaigns', 'Campaigns')}
                  {activeTab === 'adsets' && t('campaigns.tabs.adsets', 'Ad sets')}
                  {activeTab === 'ads' && t('campaigns.tabs.ads', 'Ads')}
                </p>
              </div>
              <ScrollArea className="max-h-64">
                <div className="p-2 space-y-1">
                  {COLUMN_CONFIG[activeTab].map(({ id, labelKey }) => (
                    <label
                      key={id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={visible(activeTab, id)}
                        onCheckedChange={() => toggleColumn(activeTab, id)}
                        className="rounded"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{t(labelKey)}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-2 border-t border-gray-200 dark:border-zinc-800">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => resetColumns(activeTab)}
                >
                  {t('campaigns.toolbar.resetColumns', 'Reset to default')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Export Dialog */}
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          dataType={activeTab === 'campaigns' ? 'campaigns' : activeTab === 'adsets' ? 'adsets' : 'ads'}
          data={activeTab === 'campaigns' ? filteredCampaigns : activeTab === 'adsets' ? filteredAdSets : filteredAds}
        />

        {/* Tabs */}
        <div className="flex-shrink-0">
          <div>
            <nav className="-mb-px flex gap-2">

              <button
                onClick={() => handleTabChange('campaigns')}
                className={`${activeTab === 'campaigns'
                  ? 'border-gray-200 dark:border-zinc-800 border-b-transparent text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900 font-semibold'
                  : 'border-gray-200 dark:border-zinc-800 border-b-gray-200 dark:border-b-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30'
                  } w-[250px] py-3 px-4 border border-b font-medium text-sm transition-all flex items-center gap-2 rounded-t-xl -mb-px`}
              >
                <Folder className="h-4 w-4 text-blue-500" />
                <span>{t('campaigns.tabs.campaigns', 'Campaigns')}</span>
                {selectedCampaignIds.size > 0 && (
                  <>
                    <span className="flex-1" />
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      Selected {selectedCampaignIds.size}
                      <span
                        onClick={(e) => { e.stopPropagation(); setSelectedCampaignIds(new Set()); }}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors cursor-pointer"
                        title="Clear selection"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </span>
                  </>
                )}
              </button>
              <button
                onClick={() => handleTabChange('adsets')}
                className={`${activeTab === 'adsets'
                  ? 'border-gray-200 dark:border-zinc-800 border-b-transparent text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900 font-semibold'
                  : 'border-gray-200 dark:border-zinc-800 border-b-gray-200 dark:border-b-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30'
                  } w-[250px] py-3 px-4 border border-b font-medium text-sm transition-all flex items-center gap-2 rounded-t-xl -mb-px`}
              >
                <LayoutGrid className="h-4 w-4 text-violet-500" />
                <span>{t('campaigns.tabs.adSets', 'Ad sets')}</span>
                {selectedAdSetIds.size > 0 && (
                  <>
                    <span className="flex-1" />
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      Selected {selectedAdSetIds.size}
                      <span
                        onClick={(e) => { e.stopPropagation(); setSelectedAdSetIds(new Set()); }}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors cursor-pointer"
                        title="Clear selection"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </span>
                  </>
                )}
              </button>
              <button
                onClick={() => handleTabChange('ads')}
                className={`${activeTab === 'ads'
                  ? 'border-gray-200 dark:border-zinc-800 border-b-transparent text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-900 font-semibold'
                  : 'border-gray-200 dark:border-zinc-800 border-b-gray-200 dark:border-b-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30'
                  } w-[250px] py-3 px-4 border border-b font-medium text-sm transition-all flex items-center gap-2 rounded-t-xl -mb-px`}
              >
                <Briefcase className="h-4 w-4 text-amber-500" />
                <span>{t('campaigns.tabs.ads', 'Ads')}</span>
                {selectedAdIds.size > 0 && (
                  <>
                    <span className="flex-1" />
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      Selected {selectedAdIds.size}
                      <span
                        onClick={(e) => { e.stopPropagation(); setSelectedAdIds(new Set()); }}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors cursor-pointer"
                        title="Clear selection"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </span>
                  </>
                )}
              </button>
            </nav>
          </div>
        </div>



        {/* Campaigns List */}
        {
          activeTab === 'campaigns' && (
            <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 overflow-hidden flex-1 flex flex-col min-h-0 rounded-tr-xl rounded-b-xl">
              <>
                <div className="overflow-auto flex-1 min-h-0 scrollbar-minimal-table [&>div]:overflow-visible">
                  <Table className="w-full min-w-max [&_th]:border-r [&_th]:border-gray-200 dark:[&_th]:border-zinc-800 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 dark:[&_td]:border-zinc-800 [&_td:last-child]:border-r-0 [&_tbody_td]:!py-1 [&_tbody_td]:!px-3">
                    <TableHeader className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-50 shadow-[0_1px_0_0_rgb(229_231_235)] dark:shadow-[0_1px_0_0_rgb(39_39_42)]">
                      <TableRow>
                        <TableHead className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-2 !pr-3 !pl-3 text-center align-middle">
                          <div className="flex justify-center items-center w-full">
                            <Checkbox
                              checked={campaigns.length > 0 && selectedCampaignIds.size === campaigns.length}
                              onCheckedChange={handleToggleAllCampaigns}
                              aria-label="Select all campaigns"
                              className={selectedCampaignIds.size > 0 && selectedCampaignIds.size < campaigns.length ? "data-[state=checked]:bg-blue-600" : ""}
                            />
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-20">{t('campaigns.columns.toggle', 'Active')}</TableHead>
                        {visible('campaigns', 'adAccount') && <TableHead className="max-w-[280px]">{t('campaigns.columns.adAccount', 'Ad Acc')}</TableHead>}
                        {visible('campaigns', 'name') && (
                        <TableHead
                          className="max-w-[280px] cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">
                            {t('campaigns.columns.name', 'Campaign')}
                            {sortConfig.key === 'name' && sortConfig.direction === 'asc' && <ArrowUp className="h-3 w-3" />}
                            {sortConfig.key === 'name' && sortConfig.direction === 'desc' && <ArrowDown className="h-3 w-3" />}
                            {sortConfig.key !== 'name' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        )}
                        {visible('campaigns', 'status') && (
                        <TableHead
                          className="max-w-[280px] cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1">
                            {t('campaigns.columns.status', 'Status')}
                            {sortConfig.key === 'status' && sortConfig.direction === 'asc' && <ArrowUp className="h-3 w-3" />}
                            {sortConfig.key === 'status' && sortConfig.direction === 'desc' && <ArrowDown className="h-3 w-3" />}
                            {sortConfig.key !== 'status' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        )}
                        {visible('campaigns', 'results') && (
                        <TableHead
                          className="text-right max-w-[280px] cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => handleSort('results')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {t('campaigns.columns.results', 'Results')}
                            {sortConfig.key === 'results' && sortConfig.direction === 'asc' && <ArrowUp className="h-3 w-3" />}
                            {sortConfig.key === 'results' && sortConfig.direction === 'desc' && <ArrowDown className="h-3 w-3" />}
                            {sortConfig.key !== 'results' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        )}
                        {visible('campaigns', 'costPerResult') && <SortableHeader columnKey="costPerResult" label={t('campaigns.columns.costPerResult', 'Cost per result')} align="right" className="max-w-[280px]" />}
                        {visible('campaigns', 'budget') && <SortableHeader columnKey="budget" label={t('campaigns.columns.budget', 'Budget')} align="right" className="max-w-[280px]" />}
                        {visible('campaigns', 'reach') && <SortableHeader columnKey="reach" label={t('campaigns.columns.reach', 'Reach')} align="right" className="max-w-[280px]" />}
                        {visible('campaigns', 'impressions') && <SortableHeader columnKey="impressions" label={t('campaigns.columns.impressions', 'Impressions')} align="right" className="max-w-[280px]" />}
                        {visible('campaigns', 'postEngagements') && <SortableHeader columnKey="postEngagements" label={t('campaigns.columns.postEngagements', 'Post engagements')} align="right" className="max-w-[280px]" />}
                        {visible('campaigns', 'clicks') && <SortableHeader columnKey="clicks" label={t('campaigns.columns.clicks', 'Clicks (all)')} align="right" className="max-w-[280px]" />}
                        {visible('campaigns', 'messagingContacts') && <SortableHeader columnKey="messagingContacts" label={t('campaigns.columns.messagingContacts', 'Messaging contacts')} align="right" className="max-w-[280px]" />}
                        {visible('campaigns', 'amountSpent') && (
                        <TableHead
                          className="text-right max-w-[280px] cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => handleSort('amountSpent')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {t('campaigns.columns.amountSpent', 'Amount spent')}
                            {sortConfig.key === 'amountSpent' && sortConfig.direction === 'asc' && <ArrowUp className="h-3 w-3" />}
                            {sortConfig.key === 'amountSpent' && sortConfig.direction === 'desc' && <ArrowDown className="h-3 w-3" />}
                            {sortConfig.key !== 'amountSpent' && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        )}
                        {visible('campaigns', 'createdAt') && <SortableHeader columnKey="createdAt" label={t('campaigns.columns.created', 'Created')} align="left" className="max-w-[280px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:last-child]:!border-b [&_tr:last-child]:!border-gray-200 dark:[&_tr:last-child]:!border-zinc-800 [&_td]:!py-1 [&_td]:!px-3">
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i} className="animate-pulse">
                            <TableCell className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-1 !pr-3 !pl-3 text-center align-middle"><div className="flex justify-center items-center w-full"><div className="h-5 w-5 bg-gray-200 dark:bg-zinc-800 rounded-[6px]"></div></div></TableCell>
                            <TableCell><div className="h-4 w-8 bg-gray-200 dark:bg-zinc-800 rounded-full mx-auto"></div></TableCell>
                            {visible('campaigns', 'adAccount') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('campaigns', 'name') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-48"></div></TableCell>}
                            {visible('campaigns', 'status') && <TableCell><div className="h-6 bg-gray-200 dark:bg-zinc-800 rounded-full w-16"></div></TableCell>}
                            {visible('campaigns', 'results') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'costPerResult') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'budget') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'reach') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'impressions') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'postEngagements') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'clicks') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'messagingContacts') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'amountSpent') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('campaigns', 'createdAt') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-24"></div></TableCell>}
                          </TableRow>
                        ))
                      ) : filteredCampaigns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3 + visibleColumns.campaigns.size} className="text-center !py-16">
                            <div className="flex flex-col items-center gap-4">
                              <Folder className="h-12 w-12 text-blue-400 dark:text-blue-500" aria-hidden />
                              <p className="text-gray-600 dark:text-gray-400">{campaigns.length === 0 ? t('campaigns.noCampaigns', 'No campaigns yet') : t('campaigns.noMatch', 'No campaigns match your filters')}</p>
                              {campaigns.length === 0 && (
                                <Link href="/create-ads">
                                  <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                                    {t('campaigns.createFirst', 'Create Your First Campaign')}
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCampaigns.map((campaign, index) => (
                          <TableRow key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-gray-200 dark:border-zinc-800 cursor-pointer" onClick={() => handleToggleCampaignSelection(campaign.id, !selectedCampaignIds.has(campaign.id))}>
                            <TableCell
                              className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-1 !pr-3 !pl-3 text-center align-middle text-sm text-gray-600 dark:text-gray-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex justify-center items-center w-full">
                                <Checkbox
                                  checked={selectedCampaignIds.has(campaign.id)}
                                  onCheckedChange={(checked) => handleToggleCampaignSelection(campaign.id, checked as boolean)}
                                  aria-label={`Select campaign ${campaign.name}`}
                                  className="rounded-md"
                                />
                              </div>
                            </TableCell>

                            <TableCell className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleToggleCampaign(campaign.id, campaign.status)}
                                className={`group relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${campaign.status === 'ACTIVE'
                                  ? 'bg-gradient-to-r from-green-400 to-green-500 shadow-md shadow-green-200 focus:ring-green-400'
                                  : 'bg-gray-300 hover:bg-gray-400 focus:ring-gray-400'
                                  }`}
                                title={campaign.status === 'ACTIVE' ? 'Click to pause' : 'Click to resume'}
                              >
                                <span
                                  className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out group-hover:scale-110 ${campaign.status === 'ACTIVE' ? 'translate-x-[18px]' : 'translate-x-0.5'
                                    }`}
                                />
                              </button>
                            </TableCell>
                            {visible('campaigns', 'adAccount') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div
                                    className="truncate cursor-pointer hover:text-blue-600 hover:underline"
                                    title={getAdAccountName(campaign.adAccountId)}
                                    onClick={() => window.open(`https://business.facebook.com/adsmanager/manage/campaigns?act=${getAdAccountIdForMeta(campaign.adAccountId)}`, '_blank')}
                                  >
                                    {getAdAccountName(campaign.adAccountId)}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800" align="start">
                                  <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{t('campaigns.tooltips.adAccount', 'Ad Account')}</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{getAdAccountName(campaign.adAccountId)}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('campaigns.tooltips.openMeta', 'Click to open in Meta Ads Manager')}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'name') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-900 dark:text-gray-100">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div
                                    className="truncate cursor-pointer hover:text-blue-600"
                                    style={{ maxWidth: '280px' }}
                                    title={campaign.name}
                                  >
                                    {campaign.name}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800" align="start">
                                  <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{t('campaigns.tooltips.campaignName', 'Campaign Name')}</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{campaign.name}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'status') && (
                            <TableCell className="px-3 py-1 text-sm">
                              {(() => {
                                const status = getCampaignStatus(campaign, accountMap);
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                    <span className={`text-sm font-medium ${status.textColor}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            )}
                            {visible('campaigns', 'results') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.results?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Results</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.results?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'costPerResult') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.costPerResult ? formatCurrency(campaign.costPerResult, campaign.currency) : '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Cost per result</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.costPerResult ? formatCurrency(campaign.costPerResult, campaign.currency) : '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'budget') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right" onClick={(e) => e.stopPropagation()}>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {(() => {
                                      const daily = campaign.dailyBudget || 0;
                                      const lifetime = campaign.lifetimeBudget || 0;
                                      const budget = daily > 0 ? daily : lifetime > 0 ? lifetime : 0;
                                      const budgetType = daily > 0 ? 'Daily' : lifetime > 0 ? 'Lifetime' : '';

                                      if (budget > 0) {
                                        return (
                                          <div className="flex flex-col items-end">
                                            <span className="font-medium">{formatCurrency(budget, campaign.currency)}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Campaign {budgetType}</span>
                                          </div>
                                        );
                                      }
                                      return (
                                        <div className="flex flex-col items-end">
                                          <span className="text-gray-400">-</span>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">Ad Set Budget</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-72" align="start" onClick={(e) => e.stopPropagation()}>
                                  <div className="text-sm font-medium mb-2">{t('campaigns.tooltips.budgetInfo', 'Budget Information')}</div>
                                  {editingBudgetCampaignId === campaign.id ? (
                                    <div className="space-y-3">
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          className={cn("flex-1 px-2 py-1.5 text-xs rounded border", budgetEditType === 'daily' ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-zinc-700")}
                                          onClick={() => { setBudgetEditType('daily'); setBudgetEditValue(String(campaign.dailyBudget || '')); }}
                                        >
                                          {t('campaigns.budget.daily', 'Daily')}
                                        </button>
                                        <button
                                          type="button"
                                          className={cn("flex-1 px-2 py-1.5 text-xs rounded border", budgetEditType === 'lifetime' ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-zinc-700")}
                                          onClick={() => { setBudgetEditType('lifetime'); setBudgetEditValue(String(campaign.lifetimeBudget || '')); }}
                                        >
                                          {t('campaigns.budget.lifetime', 'Lifetime')}
                                        </button>
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={budgetEditValue}
                                          onChange={(e) => setBudgetEditValue(e.target.value)}
                                          className="flex-1 h-9 px-2 rounded border border-input bg-background text-sm"
                                          placeholder={t('campaigns.budget.amount', 'Amount')}
                                        />
                                        <span className="text-xs text-muted-foreground">{campaign.currency || 'USD'}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button size="sm" className="flex-1" disabled={budgetUpdating} onClick={() => campaign.adAccountId && handleUpdateCampaignBudget(campaign.id, campaign.adAccountId, campaign.currency || 'USD')}>
                                          {budgetUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('campaigns.budget.save', 'Save')}
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={budgetUpdating} onClick={() => { setEditingBudgetCampaignId(null); setBudgetEditValue(''); }}>
                                          {t('common.cancel', 'Cancel')}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {campaign.dailyBudget && campaign.dailyBudget > 0 && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                          <span className="font-medium">{t('campaigns.tooltips.campaignDaily', 'Campaign Daily:')}</span> {formatCurrency(campaign.dailyBudget, campaign.currency)}
                                        </div>
                                      )}
                                      {campaign.lifetimeBudget && campaign.lifetimeBudget > 0 && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                          <span className="font-medium">{t('campaigns.tooltips.campaignLifetime', 'Campaign Lifetime:')}</span> {formatCurrency(campaign.lifetimeBudget, campaign.currency)}
                                        </div>
                                      )}
                                      {(!campaign.dailyBudget || campaign.dailyBudget === 0) && (!campaign.lifetimeBudget || campaign.lifetimeBudget === 0) && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                          {t('campaigns.tooltips.noBudget', 'No campaign budget set.\nBudget is managed at ad set level.').split('\n').map((line, i) => (
                                            <span key={i} className="block">{line}</span>
                                          ))}
                                        </div>
                                      )}
                                      <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => {
                                        setEditingBudgetCampaignId(campaign.id);
                                        const hasDaily = (campaign.dailyBudget || 0) > 0;
                                        setBudgetEditType(hasDaily ? 'daily' : 'lifetime');
                                        setBudgetEditValue(String(hasDaily ? campaign.dailyBudget : campaign.lifetimeBudget || ''));
                                      }}>
                                        <Edit2 className="h-4 w-4 mr-1" />
                                        {t('campaigns.budget.edit', 'Edit Budget')}
                                      </Button>
                                    </>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'reach') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.reach?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Reach</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.reach?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'impressions') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.impressions?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Impressions</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.impressions?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'postEngagements') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.postEngagements?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Post engagements</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.postEngagements?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'clicks') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.clicks?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Clicks (all)</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.clicks?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'messagingContacts') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.messagingContacts?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Messaging contacts</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.messagingContacts?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'amountSpent') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.amountSpent ? formatCurrency(campaign.amountSpent, campaign.currency) : '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Amount spent</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.amountSpent ? formatCurrency(campaign.amountSpent, campaign.currency) : '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('campaigns', 'createdAt') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {campaign.createdAt}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Created</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{campaign.createdAt}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            </div >
          )
        }

        {/* Ad Sets Tab */}
        {
          activeTab === 'adsets' && (
            <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 overflow-hidden flex-1 flex flex-col min-h-0 rounded-tr-xl rounded-b-xl">
              <>
                <div className="overflow-auto flex-1 min-h-0 scrollbar-minimal-table [&>div]:overflow-visible">
                  <Table className="w-full min-w-max [&_th]:border-r [&_th]:border-gray-200 dark:[&_th]:border-zinc-800 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 dark:[&_td]:border-zinc-800 [&_td:last-child]:border-r-0 [&_tbody_td]:!py-1 [&_tbody_td]:!px-3">
                    <TableHeader className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-50 shadow-[0_1px_0_0_rgb(229_231_235)] dark:shadow-[0_1px_0_0_rgb(39_39_42)]">
                      <TableRow>
                        <TableHead className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-2 !pr-3 !pl-3 text-center align-middle">
                          <div className="flex justify-center items-center w-full">
                            <Checkbox
                              checked={
                                filteredAdSets.length > 0 &&
                                selectedAdSetIds.size === filteredAdSets.length
                              }
                              onCheckedChange={(checked) => handleToggleAllAdSets(checked as boolean)}
                              aria-label="Select all ad sets"
                              className="rounded-md"
                            />
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-20">{t('campaigns.columns.toggle', 'Active')}</TableHead>
                        {visible('adsets', 'adAccount') && <TableHead className="max-w-[280px]">{t('campaigns.columns.adAccount', 'Ad Acc')}</TableHead>}
                        {visible('adsets', 'name') && <SortableHeader columnKey="name" label={t('campaigns.columns.adSetName', 'Ad Set Name')} align="left" className="max-w-[280px]" />}
                        {visible('adsets', 'target') && <SortableHeader columnKey="target" label={t('campaigns.columns.target', 'Target')} align="left" className="max-w-[200px]" />}
                        {visible('adsets', 'status') && <SortableHeader columnKey="status" label={t('campaigns.columns.status', 'Status')} align="left" className="max-w-[280px]" />}
                        {visible('adsets', 'results') && <SortableHeader columnKey="results" label={t('campaigns.columns.results', 'Results')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'costPerResult') && <SortableHeader columnKey="costPerResult" label={t('campaigns.columns.costPerResult', 'Cost per result')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'budget') && <SortableHeader columnKey="budget" label={t('campaigns.columns.budget', 'Budget')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'reach') && <SortableHeader columnKey="reach" label={t('campaigns.columns.reach', 'Reach')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'impressions') && <SortableHeader columnKey="impressions" label={t('campaigns.columns.impressions', 'Impressions')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'postEngagements') && <SortableHeader columnKey="postEngagements" label={t('campaigns.columns.postEngagements', 'Post engagements')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'clicks') && <SortableHeader columnKey="clicks" label={t('campaigns.columns.clicks', 'Clicks (all)')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'messagingContacts') && <SortableHeader columnKey="messagingContacts" label={t('campaigns.columns.messagingContacts', 'Messaging contacts')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'amountSpent') && <SortableHeader columnKey="amountSpent" label={t('campaigns.columns.amountSpent', 'Amount spent')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'dailyBudget') && <SortableHeader columnKey="dailyBudget" label={t('launch.dailyBudget', 'Daily Budget')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'optimization') && <SortableHeader columnKey="optimization" label={t('campaigns.columns.optimization', 'Optimization')} align="left" className="max-w-[280px]" />}
                        {visible('adsets', 'bidAmount') && <SortableHeader columnKey="bidAmount" label={t('campaigns.columns.bidAmount', 'Bid Amount')} align="right" className="max-w-[280px]" />}
                        {visible('adsets', 'createdAt') && <SortableHeader columnKey="createdAt" label={t('campaigns.columns.created', 'Created')} align="left" className="max-w-[280px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:last-child]:!border-b [&_tr:last-child]:!border-gray-200 dark:[&_tr:last-child]:!border-zinc-800 [&_td]:!py-1 [&_td]:!px-3">
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i} className="animate-pulse">
                            <TableCell className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-1 !pr-3 !pl-3 text-center align-middle"><div className="flex justify-center items-center w-full"><div className="h-5 w-5 bg-gray-200 dark:bg-zinc-800 rounded-[6px]"></div></div></TableCell>
                            <TableCell><div className="h-6 bg-gray-200 dark:bg-zinc-800 rounded-full w-11 mx-auto"></div></TableCell>
                            {visible('adsets', 'adAccount') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('adsets', 'name') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-48"></div></TableCell>}
                            {visible('adsets', 'target') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('adsets', 'status') && <TableCell><div className="h-6 bg-gray-200 dark:bg-zinc-800 rounded-full w-16"></div></TableCell>}
                            {visible('adsets', 'results') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'costPerResult') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'budget') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'reach') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'impressions') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'postEngagements') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'clicks') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'messagingContacts') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'amountSpent') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'dailyBudget') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-20 ml-auto"></div></TableCell>}
                            {visible('adsets', 'optimization') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('adsets', 'bidAmount') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('adsets', 'createdAt') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-24"></div></TableCell>}
                          </TableRow>
                        ))
                      ) : filteredAdSets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3 + visibleColumns.adsets.size} className="text-center !py-16">
                            <div className="flex flex-col items-center gap-4">
                              <LayoutGrid className="h-12 w-12 text-violet-400 dark:text-violet-500" aria-hidden />
                              <p className="text-gray-600 dark:text-gray-400">{adSets.length === 0 ? t('campaigns.noAdSets', 'No ad sets yet') : t('campaigns.noAdSetsMatch', 'No ad sets match your filters')}</p>
                              {adSets.length === 0 && (
                                <Link href="/create-ads">
                                  <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                                    {t('campaigns.createToGetStarted', 'Create a campaign to get started')}
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAdSets.map((adSet, index) => (
                          <TableRow key={adSet.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => handleToggleAdSetSelection(adSet.id, !selectedAdSetIds.has(adSet.id))}>
                            <TableCell
                              className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-1 !pr-3 !pl-3 text-center align-middle text-sm text-gray-600 dark:text-gray-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex justify-center items-center w-full">
                                <Checkbox
                                  checked={selectedAdSetIds.has(adSet.id)}
                                  onCheckedChange={(checked) => handleToggleAdSetSelection(adSet.id, checked as boolean)}
                                  aria-label={`Select ad set ${adSet.name}`}
                                  className="rounded-md"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleToggleAdSet(adSet.id, adSet.status)}
                                className={`group relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${adSet.status === 'ACTIVE'
                                  ? 'bg-gradient-to-r from-green-400 to-green-500 shadow-md shadow-green-200 focus:ring-green-400'
                                  : 'bg-gray-300 hover:bg-gray-400 focus:ring-gray-400'
                                  }`}
                                title={adSet.status === 'ACTIVE' ? 'Click to pause' : 'Click to resume'}
                              >
                                <span
                                  className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out group-hover:scale-110 ${adSet.status === 'ACTIVE' ? 'translate-x-[18px]' : 'translate-x-0.5'
                                    }`}
                                />
                              </button>
                            </TableCell>
                            {visible('adsets', 'adAccount') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div
                                    className="truncate cursor-pointer hover:text-blue-600 hover:underline"
                                    title={getAdAccountName(adSet.adAccountId)}
                                    onClick={() => window.open(`https://business.facebook.com/adsmanager/manage/adsets?act=${getAdAccountIdForMeta(adSet.adAccountId)}`, '_blank')}
                                  >
                                    {getAdAccountName(adSet.adAccountId)}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                  <div className="text-sm font-medium mb-2">{t('campaigns.tooltips.adAccount', 'Ad Account')}</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{getAdAccountName(adSet.adAccountId)}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('campaigns.tooltips.openMeta', 'Click to open in Meta Ads Manager')}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'name') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-900 dark:text-gray-100">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div
                                    className="truncate cursor-pointer hover:text-blue-600"
                                    style={{ maxWidth: '280px' }}
                                    title={adSet.name}
                                  >
                                    {adSet.name}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                  <div className="text-sm font-medium mb-2">{t('campaigns.tooltips.adSetName', 'Ad Set Name')}</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{adSet.name}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'target') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 max-w-[200px]">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div
                                    className="whitespace-pre-line text-xs line-clamp-3 cursor-pointer hover:text-blue-600 truncate max-w-[200px]"
                                    title={formatTargeting(adSet.targeting)}
                                  >
                                    {formatTargeting(adSet.targeting)}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                  <div className="text-sm font-medium mb-2">{t('campaigns.columns.target', 'Target')}</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{formatTargetingFull(adSet.targeting)}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'status') && (
                            <TableCell className="px-3 py-1 text-sm">
                              {(() => {
                                const status = getAdSetStatus(adSet, accountMap);
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                    <span className={`text-sm font-medium ${status.textColor}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            )}
                            {visible('adsets', 'results') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.results?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Results</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.results?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'costPerResult') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.costPerResult ? formatCurrency(adSet.costPerResult, adSet.currency) : '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Cost per result</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.costPerResult ? formatCurrency(adSet.costPerResult, adSet.currency) : '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'budget') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right" onClick={(e) => e.stopPropagation()}>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {(() => {
                                      const daily = adSet.dailyBudget || 0;
                                      const lifetime = adSet.lifetimeBudget || 0;
                                      const budget = daily > 0 ? daily : lifetime > 0 ? lifetime : 0;
                                      const budgetType = daily > 0 ? t('campaigns.budget.daily', 'Daily') : lifetime > 0 ? t('campaigns.budget.lifetime', 'Lifetime') : '';
                                      if (budget > 0) {
                                        return (
                                          <div className="flex flex-col items-end">
                                            <span className="font-medium">{formatCurrency(budget, adSet.currency)}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('campaigns.budget.adSet', 'Ad Set')} {budgetType}</span>
                                          </div>
                                        );
                                      }
                                      return <span className="text-gray-400">-</span>;
                                    })()}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-72" align="start" onClick={(e) => e.stopPropagation()}>
                                  <div className="text-sm font-medium mb-2">{t('campaigns.columns.budget', 'Budget')}</div>
                                  {editingBudgetAdSetId === adSet.id ? (
                                    <div className="space-y-3">
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          className={cn("flex-1 px-2 py-1.5 text-xs rounded border", budgetEditType === 'daily' ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-zinc-700")}
                                          onClick={() => { setBudgetEditType('daily'); setBudgetEditValue(String(adSet.dailyBudget || '')); }}
                                        >
                                          {t('campaigns.budget.daily', 'Daily')}
                                        </button>
                                        <button
                                          type="button"
                                          className={cn("flex-1 px-2 py-1.5 text-xs rounded border", budgetEditType === 'lifetime' ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-zinc-700")}
                                          onClick={() => { setBudgetEditType('lifetime'); setBudgetEditValue(String(adSet.lifetimeBudget || '')); }}
                                        >
                                          {t('campaigns.budget.lifetime', 'Lifetime')}
                                        </button>
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={budgetEditValue}
                                          onChange={(e) => setBudgetEditValue(e.target.value)}
                                          className="flex-1 h-9 px-2 rounded border border-input bg-background text-sm"
                                          placeholder={t('campaigns.budget.amount', 'Amount')}
                                        />
                                        <span className="text-xs text-muted-foreground">{adSet.currency || 'USD'}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button size="sm" className="flex-1" disabled={budgetUpdating} onClick={() => adSet.adAccountId && handleUpdateAdSetBudget(adSet.id, adSet.adAccountId, adSet.currency || 'USD')}>
                                          {budgetUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('campaigns.budget.save', 'Save')}
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={budgetUpdating} onClick={() => { setEditingBudgetAdSetId(null); setBudgetEditValue(''); }}>
                                          {t('common.cancel', 'Cancel')}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {adSet.dailyBudget > 0 && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                          <span className="font-medium">{t('campaigns.budget.daily', 'Daily')}:</span> {formatCurrency(adSet.dailyBudget, adSet.currency)}
                                        </div>
                                      )}
                                      {adSet.lifetimeBudget > 0 && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300">
                                          <span className="font-medium">{t('campaigns.budget.lifetime', 'Lifetime')}:</span> {formatCurrency(adSet.lifetimeBudget, adSet.currency)}
                                        </div>
                                      )}
                                      {(!adSet.dailyBudget || adSet.dailyBudget === 0) && (!adSet.lifetimeBudget || adSet.lifetimeBudget === 0) && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">-</div>
                                      )}
                                      <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => {
                                        setEditingBudgetAdSetId(adSet.id);
                                        const hasDaily = (adSet.dailyBudget || 0) > 0;
                                        setBudgetEditType(hasDaily ? 'daily' : 'lifetime');
                                        setBudgetEditValue(String(hasDaily ? adSet.dailyBudget : adSet.lifetimeBudget || ''));
                                      }}>
                                        <Edit2 className="h-4 w-4 mr-1" />
                                        {t('campaigns.budget.edit', 'Edit Budget')}
                                      </Button>
                                    </>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'reach') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.reach?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Reach</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.reach?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'impressions') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.impressions?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Impressions</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.impressions?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'postEngagements') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.postEngagements?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Post engagements</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.postEngagements?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'clicks') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.clicks?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Clicks (all)</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.clicks?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'messagingContacts') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.messagingContacts?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Messaging contacts</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.messagingContacts?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'amountSpent') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.amountSpent ? formatCurrency(adSet.amountSpent, adSet.currency) : '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Amount spent</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.amountSpent ? formatCurrency(adSet.amountSpent, adSet.currency) : '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'dailyBudget') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {formatCurrency(adSet.dailyBudget > 0 ? adSet.dailyBudget : adSet.lifetimeBudget, adSet.currency)}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">{adSet.dailyBudget > 0 ? t('launch.dailyBudget', 'Daily Budget') : t('launch.lifetimeBudget', 'Lifetime Budget')}</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{formatCurrency(adSet.dailyBudget > 0 ? adSet.dailyBudget : adSet.lifetimeBudget, adSet.currency)}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'optimization') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="truncate cursor-pointer hover:text-blue-600" title={adSet.optimizationGoal}>
                                    {adSet.optimizationGoal}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                  <div className="text-sm font-medium mb-2">{t('campaigns.columns.optimization', 'Optimization Goal')}</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.optimizationGoal}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'bidAmount') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {formatCurrency(adSet.bidAmount, adSet.currency)}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Bid Amount</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{formatCurrency(adSet.bidAmount, adSet.currency)}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('adsets', 'createdAt') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {adSet.createdAt}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Created</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{adSet.createdAt}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            </div>
          )
        }

        {/* Ads Tab */}
        {
          activeTab === 'ads' && (
            <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 overflow-hidden flex-1 flex flex-col min-h-0 rounded-tr-xl rounded-b-xl">
              <>
                <div className="overflow-auto flex-1 min-h-0 scrollbar-minimal-table [&>div]:overflow-visible">
                  <Table className="w-full min-w-max [&_th]:border-r [&_th]:border-gray-200 dark:[&_th]:border-zinc-800 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 dark:[&_td]:border-zinc-800 [&_td:last-child]:border-r-0 [&_tbody_td]:!py-1 [&_tbody_td]:!px-3">
                    <TableHeader className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-50 shadow-[0_1px_0_0_rgb(229_231_235)] dark:shadow-[0_1px_0_0_rgb(39_39_42)]">
                      <TableRow>
                        <TableHead className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-2 !pr-3 !pl-3 text-center align-middle">
                          <div className="flex justify-center items-center w-full">
                            <Checkbox
                              checked={ads.length > 0 && selectedAdIds.size === ads.length}
                              onCheckedChange={handleToggleAllAds}
                              aria-label="Select all ads"
                              className={selectedAdIds.size > 0 && selectedAdIds.size < ads.length ? "data-[state=checked]:bg-blue-600" : ""}
                            />
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-20">{t('campaigns.columns.toggle', 'Active')}</TableHead>
                        {visible('ads', 'adAccount') && <TableHead className="max-w-[280px]">{t('campaigns.columns.adAccount', 'Ad Acc')}</TableHead>}
                        {visible('ads', 'page') && <SortableHeader columnKey="page" label={t('campaigns.columns.page', 'Page')} align="left" className="max-w-[280px]" />}
                        {visible('ads', 'campaignName') && <SortableHeader columnKey="campaignName" label={t('campaigns.columns.campaign', 'Campaign')} align="left" className="max-w-[280px]" />}
                        {visible('ads', 'adSetName') && <SortableHeader columnKey="adSetName" label={t('campaigns.columns.adSet', 'Ad set')} align="left" className="max-w-[280px]" />}
                        {visible('ads', 'name') && <SortableHeader columnKey="name" label={t('campaigns.columns.adName', 'Ad Name')} align="left" className="max-w-[250px]" />}
                        {visible('ads', 'target') && <SortableHeader columnKey="target" label={t('campaigns.columns.target', 'Target')} align="left" className="max-w-[200px]" />}
                        {visible('ads', 'status') && <SortableHeader columnKey="status" label={t('campaigns.columns.status', 'Status')} align="left" className="max-w-[280px]" />}
                        {visible('ads', 'results') && <SortableHeader columnKey="results" label={t('campaigns.columns.results', 'Results')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'costPerResult') && <SortableHeader columnKey="costPerResult" label={t('campaigns.columns.costPerResult', 'Cost per result')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'budget') && <SortableHeader columnKey="budget" label={t('campaigns.columns.budget', 'Budget')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'reach') && <SortableHeader columnKey="reach" label={t('campaigns.columns.reach', 'Reach')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'impressions') && <SortableHeader columnKey="impressions" label={t('campaigns.columns.impressions', 'Impressions')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'postEngagements') && <SortableHeader columnKey="postEngagements" label={t('campaigns.columns.postEngagements', 'Post engagements')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'clicks') && <SortableHeader columnKey="clicks" label={t('campaigns.columns.clicks', 'Clicks (all)')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'messagingContacts') && <SortableHeader columnKey="messagingContacts" label={t('campaigns.columns.messagingContacts', 'Messaging contacts')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'amountSpent') && <SortableHeader columnKey="amountSpent" label={t('campaigns.columns.amountSpent', 'Amount spent')} align="right" className="max-w-[280px]" />}
                        {visible('ads', 'title') && <SortableHeader columnKey="title" label={t('campaigns.columns.title', 'Title')} align="left" className="max-w-[280px]" />}
                        {visible('ads', 'body') && <SortableHeader columnKey="body" label={t('campaigns.columns.body', 'Body')} align="left" className="max-w-[280px]" />}
                        {visible('ads', 'createdAt') && <SortableHeader columnKey="createdAt" label={t('campaigns.columns.created', 'Created')} align="left" className="max-w-[280px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:last-child]:!border-b [&_tr:last-child]:!border-gray-200 dark:[&_tr:last-child]:!border-zinc-800 [&_td]:!py-1 [&_td]:!px-3">
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i} className="animate-pulse">
                            <TableCell className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-1 !pr-3 !pl-3 text-center align-middle"><div className="flex justify-center items-center w-full"><div className="h-5 w-5 bg-gray-200 dark:bg-zinc-800 rounded-[6px]"></div></div></TableCell>
                            <TableCell><div className="h-4 w-8 bg-gray-200 dark:bg-zinc-800 rounded-full mx-auto"></div></TableCell>
                            {visible('ads', 'adAccount') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('ads', 'page') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('ads', 'campaignName') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('ads', 'adSetName') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('ads', 'name') && (
                            <TableCell className="px-3 py-1 max-w-[250px]">
                              <div className="flex items-center gap-2">
                                <div className="w-9 h-9 bg-gray-200 dark:bg-zinc-800 rounded flex-shrink-0"></div>
                                <div className="flex-1 space-y-2 min-w-0">
                                  <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-40"></div>
                                  <div className="h-3 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div>
                                </div>
                              </div>
                            </TableCell>
                            )}
                            {visible('ads', 'target') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('ads', 'status') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'results') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'costPerResult') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'budget') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'reach') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'impressions') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'postEngagements') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'clicks') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'messagingContacts') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'amountSpent') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-16 ml-auto"></div></TableCell>}
                            {visible('ads', 'title') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-24"></div></TableCell>}
                            {visible('ads', 'body') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-32"></div></TableCell>}
                            {visible('ads', 'createdAt') && <TableCell><div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-24"></div></TableCell>}
                          </TableRow>
                        ))
                      ) : filteredAds.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3 + visibleColumns.ads.size} className="text-center !py-16">
                            <div className="flex flex-col items-center gap-4">
                              <Briefcase className="h-12 w-12 text-amber-400 dark:text-amber-500" aria-hidden />
                              <p className="text-gray-600 dark:text-gray-400">{ads.length === 0 ? t('campaigns.noAds', 'No ads yet') : t('campaigns.noAdsMatch', 'No ads match your filters')}</p>
                              {ads.length === 0 && (
                                <Link href="/create-ads">
                                  <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                                    {t('campaigns.createToGetStarted', 'Create a campaign to get started')}
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAds.map((ad, index) => (
                          <TableRow key={ad.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => handleToggleAdSelection(ad.id, !selectedAdIds.has(ad.id))}>
                            <TableCell className="w-12 min-w-[3rem] max-w-[3rem] px-3 py-1 !pr-3 !pl-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-center items-center w-full">
                                <Checkbox
                                  checked={selectedAdIds.has(ad.id)}
                                  onCheckedChange={(checked) => handleToggleAdSelection(ad.id, checked as boolean)}
                                  aria-label={`Select ${ad.name}`}
                                  className="rounded-md"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleToggleAd(ad.id, ad.status)}
                                className={`group relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${ad.status === 'ACTIVE'
                                  ? 'bg-gradient-to-r from-green-400 to-green-500 shadow-md shadow-green-200 focus:ring-green-400'
                                  : 'bg-gray-300 hover:bg-gray-400 focus:ring-gray-400'
                                  }`}
                                title={ad.status === 'ACTIVE' ? 'Click to pause' : 'Click to resume'}
                              >
                                <span
                                  className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out group-hover:scale-110 ${ad.status === 'ACTIVE' ? 'translate-x-[18px]' : 'translate-x-0.5'
                                    }`}
                                />
                              </button>
                            </TableCell>

                            {visible('ads', 'adAccount') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div
                                    className="truncate cursor-pointer hover:text-blue-600 hover:underline"
                                    title={getAdAccountName(ad.adAccountId)}
                                    onClick={() => window.open(`https://business.facebook.com/adsmanager/manage/ads?act=${getAdAccountIdForMeta(ad.adAccountId)}`, '_blank')}
                                  >
                                    {getAdAccountName(ad.adAccountId)}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                  <div className="text-sm font-medium mb-2">Ad Account</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{getAdAccountName(ad.adAccountId)}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to open in Meta Ads Manager</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'page') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400" style={{ maxWidth: '280px' }}>
                              <div
                                className="flex flex-col gap-0 cursor-pointer hover:text-blue-600 min-w-0"
                                title={[ad.pageName || '-', ad.pageUsername ? `@${ad.pageUsername}` : '-', ad.pageId ? `ID: ${ad.pageId}` : '-'].join('\n')}
                                onClick={() => { const url = ad.pageUsername ? `https://www.facebook.com/${ad.pageUsername}` : ad.pageId ? `https://www.facebook.com/${ad.pageId}` : null; if (url) window.open(url, '_blank'); }}
                              >
                                <div className="truncate font-medium text-gray-900 dark:text-gray-100 hover:underline" title={ad.pageName ?? undefined}>
                                  {ad.pageName || '-'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={ad.pageUsername ?? undefined}>
                                  {ad.pageUsername ? `@${ad.pageUsername}` : '-'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={ad.pageId ?? undefined}>
                                  {ad.pageId ? `ID: ${ad.pageId}` : '-'}
                                </div>
                              </div>
                            </TableCell>
                            )}
                            {visible('ads', 'campaignName') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400" style={{ maxWidth: '280px' }}>
                              <div className="truncate" title={ad.campaignName || undefined}>{ad.campaignName || '-'}</div>
                            </TableCell>
                            )}
                            {visible('ads', 'adSetName') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400" style={{ maxWidth: '280px' }}>
                              <div className="truncate" title={ad.adSetName || undefined}>{ad.adSetName || '-'}</div>
                            </TableCell>
                            )}
                            {visible('ads', 'name') && (
                            <TableCell className="px-3 py-1 max-w-[250px]">
                              <div className="flex items-center gap-2 min-w-0">
                                {ad.imageUrl ? (
                                  <img
                                    src={ad.imageUrl}
                                    alt={ad.name}
                                    className="w-9 h-9 object-cover rounded border border-gray-200 dark:border-zinc-800 flex-shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-9 h-9 bg-gray-100 rounded border border-gray-200 dark:border-zinc-800 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[10px] text-gray-400">No</span>
                                  </div>
                                )}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div
                                      className="flex flex-col min-w-0 cursor-pointer group overflow-hidden"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate hover:text-blue-600" title={ad.name}>
                                          {ad.name}
                                        </div>
                                        {ad.postLink && (
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              window.open(ad.postLink!, '_blank');
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                                            title="View Post"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-blue-600" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={ad.id}>
                                        ID: {ad.id}
                                      </div>
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                    <div className="text-sm font-medium mb-2">Ad Name</div>
                                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ad.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">ID: {ad.id}</div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </TableCell>
                            )}
                            {visible('ads', 'target') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 max-w-[200px]">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div
                                    className="whitespace-pre-line text-xs line-clamp-3 cursor-pointer hover:text-blue-600 truncate max-w-[200px]"
                                    title={formatTargeting(ad.targeting)}
                                  >
                                    {formatTargeting(ad.targeting)}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                  <div className="text-sm font-medium mb-2">{t('campaigns.columns.target', 'Target')}</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{formatTargetingFull(ad.targeting)}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'status') && (
                            <TableCell className="px-3 py-1 text-sm">
                              {(() => {
                                const status = getAdStatus(ad, accountMap && ad.adAccountId ? accountMap[ad.adAccountId] : undefined);
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                    <span className={`text-sm font-medium ${status.textColor}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            )}
                            {visible('ads', 'results') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.results?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Results</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.results?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'costPerResult') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.costPerResult ? formatCurrency(ad.costPerResult, ad.currency) : '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Cost per result</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.costPerResult ? formatCurrency(ad.costPerResult, ad.currency) : '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'budget') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right" onClick={(e) => e.stopPropagation()}>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {(() => {
                                      if (!ad.budget) return <span className="text-gray-400">-</span>;
                                      const source = ad.budgetSource === 'campaign' ? t('campaigns.budget.campaign', 'Campaign') : t('campaigns.budget.adSet', 'Ad Set');
                                      const type = ad.budgetType === 'daily' ? t('campaigns.budget.daily', 'Daily') : t('campaigns.budget.lifetime', 'Lifetime');
                                      return (
                                        <div className="flex flex-col items-end">
                                          <span className="font-medium">{formatCurrency(ad.budget, ad.currency)}</span>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">{source} {type}</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-72" align="start" onClick={(e) => e.stopPropagation()}>
                                  <div className="text-sm font-medium mb-2">{t('campaigns.columns.budget', 'Budget')}</div>
                                  {editingBudgetAdId === ad.id ? (
                                    <div className="space-y-3">
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          className={cn("flex-1 px-2 py-1.5 text-xs rounded border", budgetEditType === 'daily' ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-zinc-700")}
                                          onClick={() => {
                                            setBudgetEditType('daily');
                                            const val = editingBudgetAdSource === 'campaign' ? (ad.campaignDailyBudget || 0) : (ad.adsetDailyBudget || 0);
                                            setBudgetEditValue(String(val || ''));
                                          }}
                                        >
                                          {t('campaigns.budget.daily', 'Daily')}
                                        </button>
                                        <button
                                          type="button"
                                          className={cn("flex-1 px-2 py-1.5 text-xs rounded border", budgetEditType === 'lifetime' ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-zinc-700")}
                                          onClick={() => {
                                            setBudgetEditType('lifetime');
                                            const val = editingBudgetAdSource === 'campaign' ? (ad.campaignLifetimeBudget || 0) : (ad.adsetLifetimeBudget || 0);
                                            setBudgetEditValue(String(val || ''));
                                          }}
                                        >
                                          {t('campaigns.budget.lifetime', 'Lifetime')}
                                        </button>
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={budgetEditValue}
                                          onChange={(e) => setBudgetEditValue(e.target.value)}
                                          className="flex-1 h-9 px-2 rounded border border-input bg-background text-sm"
                                          placeholder={t('campaigns.budget.amount', 'Amount')}
                                        />
                                        <span className="text-xs text-muted-foreground">{ad.currency || 'USD'}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          className="flex-1"
                                          disabled={budgetUpdating}
                                          onClick={() => {
                                            if (!ad.adAccountId) return;
                                            if (editingBudgetAdSource === 'campaign') {
                                              handleUpdateCampaignBudget(ad.campaignId, ad.adAccountId, ad.currency || 'USD', true);
                                            } else if (editingBudgetAdSource === 'adset') {
                                              handleUpdateAdSetBudget(ad.adsetId, ad.adAccountId, ad.currency || 'USD', true);
                                            }
                                          }}
                                        >
                                          {budgetUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('campaigns.budget.save', 'Save')}
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={budgetUpdating} onClick={() => { setEditingBudgetAdId(null); setEditingBudgetAdSource(null); setBudgetEditValue(''); }}>
                                          {t('common.cancel', 'Cancel')}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {(ad.campaignDailyBudget || 0) > 0 && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                          <span className="font-medium">{t('campaigns.budget.campaign', 'Campaign')} {t('campaigns.budget.daily', 'Daily')}:</span> {formatCurrency(ad.campaignDailyBudget!, ad.currency)}
                                        </div>
                                      )}
                                      {(ad.campaignLifetimeBudget || 0) > 0 && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                          <span className="font-medium">{t('campaigns.budget.campaign', 'Campaign')} {t('campaigns.budget.lifetime', 'Lifetime')}:</span> {formatCurrency(ad.campaignLifetimeBudget!, ad.currency)}
                                        </div>
                                      )}
                                      {(ad.adsetDailyBudget || 0) > 0 && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                          <span className="font-medium">{t('campaigns.budget.adSet', 'Ad Set')} {t('campaigns.budget.daily', 'Daily')}:</span> {formatCurrency(ad.adsetDailyBudget!, ad.currency)}
                                        </div>
                                      )}
                                      {(ad.adsetLifetimeBudget || 0) > 0 && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300">
                                          <span className="font-medium">{t('campaigns.budget.adSet', 'Ad Set')} {t('campaigns.budget.lifetime', 'Lifetime')}:</span> {formatCurrency(ad.adsetLifetimeBudget!, ad.currency)}
                                        </div>
                                      )}
                                      {!(ad.campaignDailyBudget || ad.campaignLifetimeBudget || ad.adsetDailyBudget || ad.adsetLifetimeBudget) && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">-</div>
                                      )}
                                      {((ad.campaignDailyBudget || ad.campaignLifetimeBudget) || (ad.adsetDailyBudget || ad.adsetLifetimeBudget)) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="w-full mt-2"
                                          onClick={() => {
                                            const source: 'campaign' | 'adset' = (ad.budgetSource === 'campaign' || ((ad.campaignDailyBudget || ad.campaignLifetimeBudget) && !(ad.adsetDailyBudget || ad.adsetLifetimeBudget)))
                                              ? 'campaign'
                                              : 'adset';
                                            setEditingBudgetAdId(ad.id);
                                            setEditingBudgetAdSource(source);
                                            const hasDaily = source === 'campaign'
                                              ? (ad.campaignDailyBudget || 0) > 0
                                              : (ad.adsetDailyBudget || 0) > 0;
                                            const val = hasDaily
                                              ? (source === 'campaign' ? ad.campaignDailyBudget : ad.adsetDailyBudget) || ''
                                              : (source === 'campaign' ? ad.campaignLifetimeBudget : ad.adsetLifetimeBudget) || '';
                                            setBudgetEditType(hasDaily ? 'daily' : 'lifetime');
                                            setBudgetEditValue(String(val));
                                          }}
                                        >
                                          <Edit2 className="h-4 w-4 mr-1" />
                                          {t('campaigns.budget.edit', 'Edit Budget')}
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'reach') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.reach?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Reach</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.reach?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'impressions') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.impressions?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Impressions</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.impressions?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'postEngagements') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.postEngagements?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Post engagements</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.postEngagements?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'clicks') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.clicks?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Clicks (all)</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.clicks?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'messagingContacts') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.messagingContacts?.toLocaleString() ?? '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Messaging contacts</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.messagingContacts?.toLocaleString() ?? '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'amountSpent') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 text-right">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.amountSpent ? formatCurrency(ad.amountSpent, ad.currency) : '-'}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Amount spent</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.amountSpent ? formatCurrency(ad.amountSpent, ad.currency) : '-'}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'title') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="truncate cursor-pointer hover:text-blue-600" title={ad.title}>
                                    {ad.title}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                  <div className="text-sm font-medium mb-2">Title</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ad.title}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'body') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="truncate cursor-pointer hover:text-blue-600" style={{ maxWidth: '280px' }} title={ad.body}>
                                    {ad.body}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-h-64 overflow-auto" align="start">
                                  <div className="text-sm font-medium mb-2">Body</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ad.body}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                            {visible('ads', 'createdAt') && (
                            <TableCell className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:text-blue-600 whitespace-nowrap">
                                    {ad.createdAt}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="text-sm font-medium mb-2">Created</div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">{ad.createdAt}</div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            </div>
          )
        }

      </div >
    </div >
  );
}
