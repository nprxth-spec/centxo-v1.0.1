'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Type definitions
interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  currency?: string;
  account_status?: number;
  disable_reason?: number;
  spend_cap?: string | number;
  amount_spent?: string | number;
  business_name?: string;
  _source?: {
    teamMemberId?: string;
    facebookName?: string;
    facebookUserId?: string;
  };
}

interface Page {
  id: string;
  name: string;
  username?: string | null;
  access_token?: string;
  business_name?: string;
  is_published?: boolean;
  picture?: {
    data: {
      url: string;
    }
  };
  _source?: {
    teamMemberId?: string;
    facebookName?: string;
    facebookUserId?: string;
  };
}

interface Business {
  id: string;
  name: string;
  profile_picture_uri?: string;
  verification_status?: string;
  permitted_roles?: string[];
  permitted_tasks?: string[];
  _source?: {
    teamMemberId?: string;
    facebookName?: string;
    facebookUserId?: string;
  };
}

interface ConfigContextType {
  // Ad Accounts
  selectedAccounts: AdAccount[];
  setSelectedAccounts: (accounts: AdAccount[]) => void;
  toggleAccount: (account: AdAccount) => void;
  currentAccount: AdAccount | null;
  setCurrentAccount: (account: AdAccount) => void;
  adAccounts: AdAccount[];

  // Pages
  selectedPages: Page[];
  setSelectedPages: (pages: Page[]) => void;
  togglePage: (page: Page) => void;
  pages: Page[];

  // Businesses
  selectedBusinesses: Business[];
  setSelectedBusinesses: (businesses: Business[]) => void;
  toggleBusiness: (business: Business) => void;
  businesses: Business[];

  // Business Pages (filtered by subscription)
  businessPages: Page[];

  // Business Accounts (filtered by subscription)
  businessAccounts: AdAccount[];

  // Unfiltered data for management pages (accounts-by-business, pages-by-business tabs)
  allBusinessPages: Page[];
  allBusinessAccountsUnfiltered: AdAccount[];

  // Loading states
  loading: boolean;
  error: string | null;
  refreshData: (force?: boolean, options?: { bypassCooldown?: boolean }) => Promise<void>;

  // Plan limits (ad accounts, pages, team members)
  // Plan limits (ad accounts, pages, team members)
  planLimits: PlanLimits;
}

// Create context with proper initial value
const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

import { MetaQuotaClient } from '@/lib/meta-quota-config';
import { getPlanLimits, getAdAccountLimit, getPageLimit, getTeamMemberLimit, PlanLimits } from '@/lib/plan-limits';

// Cache + cooldown from meta-quota-config (500+ user scale)
const CACHE_DURATION = MetaQuotaClient.CACHE_DURATION_MS;
const REFRESH_COOLDOWN = MetaQuotaClient.REFRESH_COOLDOWN_MS;

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter(); // Added useRouter

  // Rate Limit Circuit Breaker State
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('FREE');
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false); // Added new state

  useEffect(() => {
    if (session?.user) {
      fetch('/api/user/plan')
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            console.error('Failed to fetch plan:', res.status, text.substring(0, 100)); // Log first 100 chars
            return { plan: 'FREE' };
          }
          return res.json();
        })
        .then(data => setUserPlan(data.plan || 'FREE'))
        .catch(err => {
          console.error('Error fetching plan:', err);
          setUserPlan('FREE');
        });
    }
  }, [session]);

  const getPlanLimit = (plan: string) => getAdAccountLimit(plan);

  // Initialize state from localStorage immediately to prevent race conditions
  const [selectedAccounts, setSelectedAccountsState] = useState<AdAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('selectedAdAccounts');
        return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [selectedPages, setSelectedPagesState] = useState<Page[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('selectedPages');
        return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [selectedBusinesses, setSelectedBusinessesState] = useState<Business[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('selectedBusinesses');
        return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [adAccounts, setAdAccounts] = useState<AdAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('centxoCache_v9');
        if (cached) {
          return JSON.parse(cached).accounts || [];
        }
      } catch (e) { }
    }
    return [];
  });

  const [pages, setPages] = useState<Page[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('centxoCache_v9');
        if (cached) {
          return JSON.parse(cached).pages || [];
        }
      } catch (e) { }
    }
    return [];
  });

  const [businesses, setBusinesses] = useState<Business[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('centxoCache_v9');
        if (cached) {
          return JSON.parse(cached).businesses || [];
        }
      } catch (e) { }
    }
    return [];
  });

  const [businessPages, setBusinessPages] = useState<Page[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('centxoCache_v9');
        if (cached) {
          return JSON.parse(cached).businessPages || [];
        }
      } catch (e) { }
    }
    return [];
  });

  const [businessAccounts, setBusinessAccounts] = useState<AdAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('centxoCache_v9');
        if (cached) {
          return JSON.parse(cached).businessAccounts || [];
        }
      } catch (e) { }
    }
    return [];
  });

  // Unfiltered data for management pages (accounts-by-business, pages-by-business tabs)
  // Initialize from same cache as businessPages/businessAccounts so tabs show data before API returns
  const [allBusinessPagesUnfiltered, setAllBusinessPagesUnfiltered] = useState<Page[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('centxoCache_v9');
        if (cached) {
          const data = JSON.parse(cached);
          return data.allBusinessPages ?? data.businessPages ?? [];
        }
      } catch (e) { }
    }
    return [];
  });
  const [allBusinessAccountsUnfilteredState, setAllBusinessAccountsUnfilteredState] = useState<AdAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('centxoCache_v9');
        if (cached) {
          const data = JSON.parse(cached);
          return data.allBusinessAccountsUnfiltered ?? data.businessAccounts ?? [];
        }
      } catch (e) { }
    }
    return [];
  });

  const lastManualRefreshRef = useRef<number>(0);

  const [lastFetched, setLastFetched] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('centxoCache_v9');
        if (cached) {
          return JSON.parse(cached).timestamp || 0;
        }
      } catch (e) { }
    }
    return 0;
  });

  const stateRef = useRef({ adAccounts, pages, businesses, businessPages, businessAccounts, lastFetched, isRateLimited, selectedAccounts, selectedPages });
  stateRef.current = { adAccounts, pages, businesses, businessPages, businessAccounts, lastFetched, isRateLimited, selectedAccounts, selectedPages };

  // Show cached data immediately (even if expired) for faster tab load - stale-while-revalidate
  const hasAnyCachedData = () => {
    if (typeof window === 'undefined') return false;
    try {
      const cached = localStorage.getItem('centxoCache_v9');
      if (!cached) return false;
      const data = JSON.parse(cached);
      return !!(data.accounts?.length || data.pages?.length || data.businesses?.length ||
        data.businessPages?.length || data.businessAccounts?.length);
    } catch { return false; }
  };
  const [loading, setLoading] = useState(!hasAnyCachedData());
  const [error, setError] = useState<string | null>(null);

  // Check if we have valid cache on mount to stop loading immediately
  useEffect(() => {
    const now = Date.now();
    if (lastFetched > 0 && (now - lastFetched < CACHE_DURATION)) {
      setLoading(false);
    }
  }, [lastFetched]);

  // Check Rate Limit on Mount
  useEffect(() => {
    const cooldown = localStorage.getItem('rateLimitCooldown');
    if (cooldown && parseInt(cooldown) > Date.now()) {
      setIsRateLimited(true);
      console.warn('API Rate Limit active. Requests paused until:', new Date(parseInt(cooldown)).toLocaleTimeString());
    }
  }, []);

  // Persist cache helper (allBp/allBa optional - for by-business tabs on reload)
  const saveToCache = (
    accounts: AdAccount[], p: Page[], b: Business[], bp: Page[], ba: AdAccount[], timestamp: number,
    allBp?: Page[], allBa?: AdAccount[]
  ) => {
    const payload: Record<string, unknown> = { accounts, pages: p, businesses: b, businessPages: bp, businessAccounts: ba, timestamp };
    if (allBp) payload.allBusinessPages = allBp;
    if (allBa) payload.allBusinessAccountsUnfiltered = allBa;
    localStorage.setItem('centxoCache_v9', JSON.stringify(payload));
  };

  const handleApiError = async (response: Response) => {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || errorData.error || `Request failed: ${response.status}`;

    // Check for Facebook Rate Limit Codes
    const code = errorData.error?.code;
    if (response.status === 400 || code === 80004 || code === 17 || code === 32 || code === 613) {
      console.error("RATE LIMIT DETECTED. Activating circuit breaker for 15 minutes.");
      const cooldownUntil = Date.now() + (15 * 60 * 1000);
      localStorage.setItem('rateLimitCooldown', cooldownUntil.toString());
      setIsRateLimited(true);
    }

    throw new Error(errorMessage);
  };

  // Fetch config - single API call (accounts + pages + businesses) - reduces Meta API calls by ~50%
  const fetchConfig = async (force: boolean = false) => {
    const { adAccounts: accs, pages: pgs, businesses: biz, businessPages: bpFb, businessAccounts: baFb, selectedAccounts: selAcc, selectedPages: selPg, isRateLimited: rateLtd } = stateRef.current;
    if (rateLtd) {
      if (accs.length > 0 || pgs.length > 0 || biz.length > 0) {
        return { accounts: accs, pages: pgs, businesses: biz, businessPages: bpFb, businessAccounts: baFb };
      }
      throw new Error("System is cooling down from API rate limits. Please try again in 15 minutes.");
    }
    const url = force ? '/api/team/config?refresh=true' : '/api/team/config';
    const res = await fetch(url, force ? { cache: 'no-store' } : undefined);
    if (!res.ok) {
      const hasData = accs.length > 0 || pgs.length > 0 || biz.length > 0;
      if (hasData) {
        try { await handleApiError(res); } catch (e) { console.warn(e); }
        return { accounts: accs, pages: pgs, businesses: biz, businessPages: bpFb, businessAccounts: baFb };
      }
      await handleApiError(res);
    }
    const data = await res.json();
    const accounts = data.accounts || [];
    const p = data.pages || [];
    const b = data.businesses || [];
    const bp = data.businessPages || [];
    const ba = data.businessAccounts || [];

    // Subscription selections from API (source of truth from /account settings)
    const subscriptionSelectedAccountIds: string[] = data.subscriptionSelectedAccountIds || [];
    const subscriptionSelectedPageIds: string[] = data.subscriptionSelectedPageIds || [];

    setAdAccounts(accounts);
    setPages(p);
    setBusinesses(b);
    setBusinessPages(bp);
    setBusinessAccounts(ba);

    // Store unfiltered data for management pages
    setAllBusinessPagesUnfiltered(data.allBusinessPages || bp);
    setAllBusinessAccountsUnfilteredState(data.allBusinessAccountsUnfiltered || ba);

    // Logic for individual selections:
    // Subscription from API is source of truth: when non-empty, selection = subscription selection.
    // This ensures after saving 10 in Manage Access and refresh, UI shows 10 (not previous 1).
    const { selectedAccounts: currentSelectedAccs, selectedPages: currentSelectedPgs } = stateRef.current;

    // Accounts: prefer subscription selection from API when present
    if (subscriptionSelectedAccountIds.length > 0 && accounts.length > 0) {
      const subSelected = accounts.filter((acc: any) => subscriptionSelectedAccountIds.includes(acc.id));
      setSelectedAccounts(subSelected);
    } else if (currentSelectedAccs.length === 0 && accounts.length > 0) {
      setSelectedAccounts(accounts);
    } else {
      const validSelected = currentSelectedAccs.filter((s: any) => accounts.some((a: any) => a.id === s.id));
      if (validSelected.length !== currentSelectedAccs.length) setSelectedAccounts(validSelected);
    }

    // Pages: prefer subscription selection from API when present
    if (subscriptionSelectedPageIds.length > 0 && p.length > 0) {
      const subSelected = p.filter((page: any) => subscriptionSelectedPageIds.includes(page.id));
      setSelectedPages(subSelected);
    } else if (currentSelectedPgs.length === 0 && p.length > 0) {
      setSelectedPages(p);
    } else {
      const validSelected = currentSelectedPgs.filter((s: any) => p.some((a: any) => a.id === s.id));
      if (validSelected.length !== currentSelectedPgs.length) setSelectedPages(validSelected);
    }

    return {
      accounts, pages: p, businesses: b, businessPages: bp, businessAccounts: ba,
      allBusinessPages: data.allBusinessPages ?? bp,
      allBusinessAccountsUnfiltered: data.allBusinessAccountsUnfiltered ?? ba,
    };
  };

  // Refresh - stable reference to prevent useEffect loops in child components
  const refreshData = useCallback(async (force: boolean = false, options?: { bypassCooldown?: boolean }) => {
    const { adAccounts: accs, pages: pgs, businesses: biz, lastFetched: lf, isRateLimited: rateLtd } = stateRef.current;
    if (rateLtd) {
      if (accs.length > 0 || pgs.length > 0 || biz.length > 0) {
        setLoading(false);
        return;
      }
      setError("System is cooling down from API rate limits. Please try again in 15 minutes.");
      setLoading(false);
      return;
    }

    const now = Date.now();
    const useCacheDueToCooldown = force && !options?.bypassCooldown && lastManualRefreshRef.current > 0 && (now - lastManualRefreshRef.current < REFRESH_COOLDOWN);
    if (force && !useCacheDueToCooldown) lastManualRefreshRef.current = now;

    const hasDataToShow = accs.length > 0 || pgs.length > 0 || biz.length > 0;
    const skipCache = !hasDataToShow;
    if (!force && !skipCache && lf > 0 && (now - lf < CACHE_DURATION)) {
      setLoading(false);
      return;
    }

    if (!hasDataToShow) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetchConfig(useCacheDueToCooldown ? false : force);
      const { accounts, pages: p, businesses: b, businessPages: bp, businessAccounts: ba, allBusinessPages: allBp, allBusinessAccountsUnfiltered: allBa } = result;
      const current = stateRef.current;
      setLastFetched(Date.now());
      saveToCache(accounts || current.adAccounts, p || current.pages, b || current.businesses, bp || [], ba || [], Date.now(), allBp, allBa);
    } catch (err) {
      console.error("Error refreshing data:", err);
      const curr = stateRef.current;
      if (curr.adAccounts.length === 0 && curr.pages.length === 0 && curr.businesses.length === 0) {
        setError(err instanceof Error ? err.message : "Failed to refresh data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load - use cache when valid (localStorage + server in-memory). User can click Refresh for fresh data.
  useEffect(() => {
    if (session?.user) {
      refreshData(false);
    }
  }, [session?.user?.email]);

  // When user switches back to this tab: only re-use cache (no force refresh) to avoid burning Meta API quota.
  // User can click Refresh on any page when they need fresh data.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshData(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshData]);

  const setSelectedAccounts = (accounts: AdAccount[]) => {
    const limit = getPlanLimit(userPlan);
    if (accounts.length > limit) {
      // alert(`Your current plan (${userPlan}) allows only ${limit} ad account(s). Please upgrade to add more.`);
      // We will just slice it for set, but ideally we warn. 
      // Since this is often called by auto-select, we might just cap it silently or log.
      // But for manual selection, we need to block.
      // Let's assume this setter is used for state updates, so we cap it.
      accounts = accounts.slice(0, limit);
    }
    setSelectedAccountsState(accounts);
    localStorage.setItem('selectedAdAccounts', JSON.stringify(accounts));
  };

  const setSelectedPages = (p: Page[]) => {
    const pageLimit = getPageLimit(userPlan);
    if (p.length > pageLimit) {
      p = p.slice(0, pageLimit);
    }
    setSelectedPagesState(p);
    localStorage.setItem('selectedPages', JSON.stringify(p));
  };

  const setSelectedBusinesses = (b: Business[]) => {
    setSelectedBusinessesState(b);
    localStorage.setItem('selectedBusinesses', JSON.stringify(b));
  };

  const toggleAccount = (account: AdAccount) => {
    const isSelected = selectedAccounts.some(acc => acc.id === account.id);
    let newSelected: AdAccount[];
    const limit = getPlanLimit(userPlan);

    if (isSelected) {
      newSelected = selectedAccounts.filter(acc => acc.id !== account.id);
    } else {
      if (selectedAccounts.length >= limit) {
        setIsLimitDialogOpen(true);
        return;
      }
      newSelected = [...selectedAccounts, account];
    }

    setSelectedAccounts(newSelected);
  };

  const togglePage = (page: Page) => {
    const isSelected = selectedPages.some(p => p.id === page.id);
    let newSelected: Page[];
    const pageLimit = getPageLimit(userPlan);

    if (isSelected) {
      newSelected = selectedPages.filter(p => p.id !== page.id);
    } else {
      if (selectedPages.length >= pageLimit) {
        // Could show dialog similar to account limit
        return;
      }
      newSelected = [...selectedPages, page];
    }

    setSelectedPages(newSelected);
  };

  const toggleBusiness = (business: Business) => {
    const isSelected = selectedBusinesses.some(b => b.id === business.id);
    let newSelected: Business[];

    if (isSelected) {
      newSelected = selectedBusinesses.filter(b => b.id !== business.id);
    } else {
      newSelected = [...selectedBusinesses, business];
    }

    setSelectedBusinesses(newSelected);
  };

  return (
    <ConfigContext.Provider
      value={{
        selectedAccounts,
        setSelectedAccounts,
        currentAccount: selectedAccounts[0] || null,
        setCurrentAccount: (account) => {
          if (account) {
            if (!selectedAccounts.some(a => a.id === account.id)) {
              setSelectedAccounts([...selectedAccounts, account]);
            }
          }
        },
        toggleAccount,
        adAccounts,
        selectedPages,
        setSelectedPages,
        togglePage,
        pages,
        selectedBusinesses,
        setSelectedBusinesses,
        toggleBusiness,
        businesses,
        businessPages,
        businessAccounts,
        allBusinessPages: allBusinessPagesUnfiltered,
        allBusinessAccountsUnfiltered: allBusinessAccountsUnfilteredState,
        loading,
        error,
        refreshData,
        planLimits: getPlanLimits(userPlan),
      }}
    >
      {children}
      <AlertDialog open={isLimitDialogOpen} onOpenChange={setIsLimitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              Your "{userPlan}" plan is limited to <span className="font-bold text-foreground">{getPlanLimit(userPlan)}</span> ad account(s).
              Please upgrade your plan to select more accounts and unlock advanced features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setIsLimitDialogOpen(false);
                router.push('/settings?tab=subscription');
              }}
            >
              Upgrade Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
}

// Backward compatibility - export as useAdAccount
export const useAdAccount = useConfig;
export const AdAccountProvider = ConfigProvider;
