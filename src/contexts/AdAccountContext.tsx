'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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

  // Business Pages (all pages in business portfolios - for Pages by Business tab)
  businessPages: Page[];

  // Business Accounts (all ad accounts in business portfolios - for Accounts by Business tab)
  businessAccounts: AdAccount[];

  // Loading states
  loading: boolean;
  error: string | null;
  refreshData: (force?: boolean, options?: { bypassCooldown?: boolean }) => Promise<void>;
}

// Create context with proper initial value
const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

// Cache duration in milliseconds (60 minutes) - reduces Meta API rate limit usage
const CACHE_DURATION = 60 * 60 * 1000;
// Manual Refresh cooldown (10 minutes) - prevent unnecessary API calls when user clicks Refresh repeatedly
const REFRESH_COOLDOWN = 10 * 60 * 1000;

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

  const getPlanLimit = (plan: string) => {
    // Temporarily allow all plans to use full features (no ad account limit)
    return 999;
    // switch (plan) {
    //   case 'PRO': return 50;
    //   case 'PLUS': return 20;
    //   default: return 10;
    // }
  };

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
        const cached = localStorage.getItem('adPilotCache_v9');
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
        const cached = localStorage.getItem('adPilotCache_v9');
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
        const cached = localStorage.getItem('adPilotCache_v9');
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
        const cached = localStorage.getItem('adPilotCache_v9');
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
        const cached = localStorage.getItem('adPilotCache_v9');
        if (cached) {
          return JSON.parse(cached).businessAccounts || [];
        }
      } catch (e) { }
    }
    return [];
  });

  const lastManualRefreshRef = useRef<number>(0);

  const [lastFetched, setLastFetched] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('adPilotCache_v9');
        if (cached) {
          return JSON.parse(cached).timestamp || 0;
        }
      } catch (e) { }
    }
    return 0;
  });

  // Start with loading=false if we have cached data (stale-while-revalidate = show fast)
  const hasCachedData = () => {
    if (typeof window === 'undefined') return false;
    try {
      const cached = localStorage.getItem('adPilotCache_v9');
      if (!cached) return false;
      const data = JSON.parse(cached);
      const hasAny = data.accounts?.length > 0 || data.pages?.length > 0 || data.businesses?.length > 0 ||
        data.businessPages?.length > 0 || data.businessAccounts?.length > 0;
      const age = data.timestamp ? Date.now() - data.timestamp : Infinity;
      return hasAny && age < CACHE_DURATION;
    } catch { return false; }
  };
  const [loading, setLoading] = useState(!hasCachedData());
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

  // Persist cache helper
  const saveToCache = (accounts: AdAccount[], p: Page[], b: Business[], bp: Page[], ba: AdAccount[], timestamp: number) => {
    localStorage.setItem('adPilotCache_v9', JSON.stringify({ accounts, pages: p, businesses: b, businessPages: bp, businessAccounts: ba, timestamp }));
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
    if (isRateLimited) {
      if (adAccounts.length > 0 || pages.length > 0 || businesses.length > 0) {
        return { accounts: adAccounts, pages, businesses, businessPages, businessAccounts };
      }
      throw new Error("System is cooling down from API rate limits. Please try again in 15 minutes.");
    }
    const url = force ? '/api/team/config?refresh=true' : '/api/team/config';
    const res = await fetch(url, force ? { cache: 'no-store' } : undefined);
    if (!res.ok) {
      const hasData = adAccounts.length > 0 || pages.length > 0 || businesses.length > 0;
      if (hasData) {
        try { await handleApiError(res); } catch (e) { console.warn(e); }
        return { accounts: adAccounts, pages, businesses, businessPages, businessAccounts };
      }
      await handleApiError(res);
    }
    const data = await res.json();
    const accounts = data.accounts || [];
    const p = data.pages || [];
    const b = data.businesses || [];
    const bp = data.businessPages || [];
    const ba = data.businessAccounts || [];

    setAdAccounts(accounts);
    setPages(p);
    setBusinesses(b);
    setBusinessPages(bp);
    setBusinessAccounts(ba);

    const validSelectedAccounts = selectedAccounts.filter((s) =>
      accounts.some((acc: AdAccount) => acc.id === s.id)
    );
    const hasSavedSelection =
      typeof window !== 'undefined' && localStorage.getItem('selectedAdAccounts') !== null;
    if (validSelectedAccounts.length === 0 && accounts.length > 0 && !hasSavedSelection) {
      setSelectedAccounts(accounts);
    } else if (validSelectedAccounts.length !== selectedAccounts.length) {
      setSelectedAccounts(validSelectedAccounts);
    }

    const validSelectedPages = selectedPages.filter((s) =>
      p.some((page: Page) => page.id === s.id)
    );
    const hasSavedPages =
      typeof window !== 'undefined' && localStorage.getItem('selectedPages') !== null;
    if (validSelectedPages.length === 0 && p.length > 0 && !hasSavedPages) {
      setSelectedPages(p);
    } else if (validSelectedPages.length !== selectedPages.length) {
      setSelectedPages(validSelectedPages);
    }

    return { accounts, pages: p, businesses: b, businessPages: bp, businessAccounts: ba };
  };

  // Refresh - single API call instead of 3 (reduces Meta rate limit usage)
  const refreshData = async (force: boolean = false, options?: { bypassCooldown?: boolean }) => {
    if (isRateLimited) {
      if (adAccounts.length > 0 || pages.length > 0 || businesses.length > 0) {
        setLoading(false);
        return;
      }
      setError("System is cooling down from API rate limits. Please try again in 15 minutes.");
      setLoading(false);
      return;
    }

    const now = Date.now();
    // Manual Refresh cooldown: if user clicked Refresh within 5 min, use cache (don't force API call) - refresh works normally but data comes from cache
    const useCacheDueToCooldown = force && !options?.bypassCooldown && lastManualRefreshRef.current > 0 && (now - lastManualRefreshRef.current < REFRESH_COOLDOWN);
    if (force && !useCacheDueToCooldown) lastManualRefreshRef.current = now;

    const hasDataToShow = adAccounts.length > 0 || pages.length > 0 || businesses.length > 0;
    // When we have no data, always refetch (don't trust stale empty cache)
    const skipCache = !hasDataToShow;
    if (!force && !skipCache && lastFetched > 0 && (now - lastFetched < CACHE_DURATION)) {
      setLoading(false);
      return;
    }

    if (!hasDataToShow) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetchConfig(useCacheDueToCooldown ? false : force);
      const { accounts, pages: p, businesses: b, businessPages: bp, businessAccounts: ba } = result;

      setLastFetched(Date.now());
      saveToCache(accounts || adAccounts, p || pages, b || businesses, bp || businessPages, ba || businessAccounts, Date.now());
    } catch (err) {
      console.error("Error refreshing data:", err);
      if (adAccounts.length === 0 && pages.length === 0 && businesses.length === 0) {
        setError(err instanceof Error ? err.message : "Failed to refresh data");
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load - use cache when valid (localStorage + server in-memory). User can click Refresh for fresh data.
  useEffect(() => {
    if (session?.user) {
      refreshData(false);
    }
  }, [session?.user?.email]);

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

    if (isSelected) {
      newSelected = selectedPages.filter(p => p.id !== page.id);
    } else {
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
        loading,
        error,
        refreshData
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
                router.push('/pricing');
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
