import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fromBasicUnits } from '@/lib/currency-utils';
import { getCached, setCache, generateCacheKey, CacheTTL } from '@/lib/cache/redis';
import { getTeamPagesForUser } from '@/lib/team-pages-server';
import { getTeamFacebookConnections } from '@/lib/team-connections-server';
import { refreshTeamMemberTokenIfNeeded } from '@/lib/facebook/refresh-token';
import { getSubscriptionPool } from '@/lib/subscription-filter';

/**
 * Combined API: ad accounts + pages + businesses in one request.
 * Uses same team resolution and tokens - ensures consistency.
 * REDUCES Meta API calls: 3 per member (businesses, adaccounts, accounts) vs 6+ when called separately.
 * Cache: Redis (2h) when available, in-memory fallback - supports 200+ users.
 */
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CACHE_TTL_SEC = CacheTTL.TEAM_CONFIG; // 7200 sec

declare global {
  var _teamConfigCache: Record<string, { data: any; timestamp: number }> | undefined;
}

const memoryCache = globalThis._teamConfigCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._teamConfigCache = memoryCache;

/** Fetch all pages from a paginated Meta API response. Appends token to next URL if needed. */
async function fetchAllPaginated(
  initialUrl: string,
  token: string
): Promise<{ data: any[]; paging?: { next?: string } }> {
  const all: any[] = [];
  let url: string | null = initialUrl;
  while (url) {
    const res: Response = await fetch(url);
    if (!res.ok) break;
    const json = await res.json();
    if (json.error) break;
    if (json.data && Array.isArray(json.data)) all.push(...json.data);
    const next = json.paging?.next;
    url = next ? (next.includes('access_token=') ? next : `${next}${next.includes('?') ? '&' : '?'}access_token=${token}`) : null;
  }
  return { data: all };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { getEffectiveHostId } = await import('@/lib/team-utils');
    const hostId = await getEffectiveHostId(user.id, session.user.email);

    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const cacheKeyBase = `config_v15_${user.id}`; // v15: team-wide data (host + all team members with Facebook)

    // Try Redis first (shared across instances, supports 200+ users)
    if (!forceRefresh) {
      const redisCached = await getCached<any>(generateCacheKey('team:config', user.id));
      if (redisCached) {
        // Backfill for old cache entries missing unfiltered keys (so by-business tabs have data)
        const out = { ...redisCached };
        if (!Array.isArray(out.allBusinessPages)) out.allBusinessPages = out.businessPages ?? [];
        if (!Array.isArray(out.allBusinessAccountsUnfiltered)) out.allBusinessAccountsUnfiltered = out.businessAccounts ?? [];
        return NextResponse.json(out);
      }
    }

    // Fallback: in-memory cache (per-instance)
    if (!forceRefresh && memoryCache[cacheKeyBase]) {
      const cached = memoryCache[cacheKeyBase];
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        const data = cached.data;
        const out = { ...data };
        if (!Array.isArray(out.allBusinessPages)) out.allBusinessPages = out.businessPages ?? [];
        if (!Array.isArray(out.allBusinessAccountsUnfiltered)) out.allBusinessAccountsUnfiltered = out.businessAccounts ?? [];
        return NextResponse.json(out);
      }
    }

    // Use all team Facebook connections (host + every team member who connected Facebook)
    // so everyone in the team sees the same pages and ad accounts.
    const connections = await getTeamFacebookConnections(user.id, session.user.email ?? undefined);

    if (connections.length === 0) {
      const empty = {
        accounts: [], pages: [], businessPages: [], businessAccounts: [], businesses: [],
        allBusinessPages: [], allBusinessAccountsUnfiltered: [],
        subscriptionSelectedPageIds: [], subscriptionSelectedAccountIds: [],
      };
      memoryCache[cacheKeyBase] = { data: empty, timestamp: Date.now() };
      await setCache(generateCacheKey('team:config', user.id), empty, CACHE_TTL_SEC);
      return NextResponse.json(empty);
    }

    // Map to the shape expected by the loop (tokens already refreshed by getTeamFacebookConnections)
    const teamMembers = connections.map((c) => ({
      id: c.id,
      accessToken: c.accessToken,
      accessTokenExpires: c.expiresAt,
      facebookUserId: c.facebookUserId,
      facebookName: c.facebookName,
      _fromMetaAccount: true, // use token as-is (already valid)
    })) as any[];

    const allAccounts: any[] = [];
    const allBusinessAccounts: any[] = [];
    const allPages: any[] = [];
    const allBusinessPages: any[] = [];
    const seenPageIds = new Set<string>();
    const seenBusinessPageIds = new Set<string>();
    const seenBusinessAccountIds = new Set<string>();
    const allBusinessesMap = new Map<string, any>();
    const businessMap = new Map<string, string>();
    const businessIdToProfile = new Map<string, string>();
    const adAccountToBusinessMap = new Map<string, { name: string; profilePictureUri?: string }>();
    const pageToBusinessMap = new Map<string, string>();

    const bizFields = 'id,name,profile_picture_uri,verification_status,permitted_roles,permitted_tasks,client_ad_accounts.limit(500){id,name,account_id,account_status},owned_ad_accounts.limit(500){id,name,account_id,account_status},client_pages.limit(500){id,name,picture,is_published},owned_pages.limit(500){id,name,picture,is_published}';

    // Process each team connection (host + all team members with Facebook)
    for (const member of teamMembers) {
      let token: string;
      if ((member as any)._fromMetaAccount) {
        token = member.accessToken!;
        if (member.accessTokenExpires && new Date(member.accessTokenExpires) < new Date()) {
          console.warn('[team/config] User token expired, skipping');
          continue;
        }
      } else {
        const result = await refreshTeamMemberTokenIfNeeded(member as any);
        if (!result) continue;
        if (!result.didExtend && member.accessTokenExpires && new Date(member.accessTokenExpires) < new Date()) continue;
        token = result.token;
      }

      // Simplified fields for iterative fetch
      const basicBizFields = 'id,name,profile_picture_uri,verification_status,permitted_roles,permitted_tasks';

      // Fetch all with pagination
      const [bizResult, accountsResult, pagesResult] = await Promise.all([
        fetchAllPaginated(
          `https://graph.facebook.com/v21.0/me/businesses?fields=${encodeURIComponent(basicBizFields)}&limit=500&access_token=${token}`,
          token
        ),
        fetchAllPaginated(
          `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,account_status,disable_reason,spend_cap,amount_spent,timezone_name,timezone_offset_hours_utc,business_country_code,business{id,name,profile_picture_uri},owner{id,name},funding_source_details&limit=500&access_token=${token}`,
          token
        ),
        fetchAllPaginated(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,username,picture,access_token,business&limit=500&access_token=${token}`,
          token
        ),
      ]);

      // Process businesses iteratively (Robust Discovery)
      // Nested fields often fail to return all data, so we fetch edges explicitly per business.
      const processBusiness = async (b: any) => {
        businessMap.set(b.id, b.name);
        if (b.profile_picture_uri) businessIdToProfile.set(b.id, b.profile_picture_uri);

        allBusinessesMap.set(b.id, {
          ...b,
          _source: {
            teamMemberId: member.id,
            facebookName: member.facebookName,
            facebookUserId: member.facebookUserId,
          },
        });

        // Parallel fetch for this business's assets
        const [clientAds, ownedAds, clientPgs, ownedPgs] = await Promise.all([
          fetchAllPaginated(`https://graph.facebook.com/v21.0/${b.id}/client_ad_accounts?fields=id,name,account_id,currency,account_status,business,owner&limit=500&access_token=${token}`, token),
          fetchAllPaginated(`https://graph.facebook.com/v21.0/${b.id}/owned_ad_accounts?fields=id,name,account_id,currency,account_status,business,owner&limit=500&access_token=${token}`, token),
          fetchAllPaginated(`https://graph.facebook.com/v21.0/${b.id}/client_pages?fields=id,name,picture,is_published,access_token&limit=500&access_token=${token}`, token),
          fetchAllPaginated(`https://graph.facebook.com/v21.0/${b.id}/owned_pages?fields=id,name,picture,is_published,access_token&limit=500&access_token=${token}`, token)
        ]);

        const addAccount = (acc: any) => {
          adAccountToBusinessMap.set(acc.id, { name: b.name, profilePictureUri: b.profile_picture_uri });
          if (acc.account_id) adAccountToBusinessMap.set(acc.account_id, { name: b.name, profilePictureUri: b.profile_picture_uri });

          if (!seenBusinessAccountIds.has(acc.id)) {
            seenBusinessAccountIds.add(acc.id);
            allBusinessAccounts.push({
              ...acc,
              business_name: b.name,
              _source: {
                teamMemberId: member.id,
                facebookName: member.facebookName,
                facebookUserId: member.facebookUserId,
              },
            });
          }
        };

        const addPage = (p: any) => {
          pageToBusinessMap.set(p.id, b.name);
          if (!seenBusinessPageIds.has(p.id)) {
            seenBusinessPageIds.add(p.id);
            allBusinessPages.push({
              ...p,
              business_name: b.name,
              _source: {
                teamMemberId: member.id,
                facebookName: member.facebookName,
                facebookUserId: member.facebookUserId,
              },
            });
          }
        };

        clientAds.data?.forEach(addAccount);
        ownedAds.data?.forEach(addAccount);
        clientPgs.data?.forEach(addPage);
        ownedPgs.data?.forEach(addPage);
      };

      // Process all businesses in parallel
      if (bizResult.data && Array.isArray(bizResult.data)) {
        await Promise.all(bizResult.data.map(processBusiness));
      }

      // Process ad accounts
      if (accountsResult.data && Array.isArray(accountsResult.data)) {
        accountsResult.data.forEach((account: any) => {
          const currency = account.currency || 'USD';
          let businessName = account.business?.name || account.owner?.name;
          if (!businessName && account.business?.id) businessName = businessMap.get(account.business.id);
          if (!businessName) {
            const shared = adAccountToBusinessMap.get(account.id) || adAccountToBusinessMap.get(account.account_id);
            businessName = shared?.name || 'Personal Account';
          }
          if (!businessName) businessName = 'Personal Account';

          let businessProfilePictureUri = account.business?.profile_picture_uri;
          if (!businessProfilePictureUri && account.business?.id) {
            businessProfilePictureUri = businessIdToProfile.get(account.business.id);
          }

          allAccounts.push({
            ...account,
            business_name: businessName,
            business_profile_picture_uri: businessProfilePictureUri,
            spend_cap: fromBasicUnits(account.spend_cap, currency),
            amount_spent: fromBasicUnits(account.amount_spent, currency),
            _source: {
              teamMemberId: member.id,
              facebookName: member.facebookName,
              facebookUserId: member.facebookUserId,
            },
          });
        });
      }

      // Process pages (me/accounts - direct pages)
      if (pagesResult.data && Array.isArray(pagesResult.data)) {
        pagesResult.data.forEach((page: any) => {
          if (seenPageIds.has(page.id)) return;
          seenPageIds.add(page.id);
          let businessName = page.business?.name;
          if (!businessName && page.business?.id) businessName = businessMap.get(page.business.id);
          if (!businessName) businessName = pageToBusinessMap.get(page.id);
          if (!businessName) businessName = page.business?.id ? `(Biz ID: ${page.business.id})` : 'Personal Page';

          allPages.push({
            ...page,
            business_name: businessName,
            _source: {
              teamMemberId: member.id,
              facebookName: member.facebookName,
              facebookUserId: member.facebookUserId,
            },
          });
        });
      }
    }

    // Merge access_token from me/accounts into businessPages - so OAuth-granted pages show "Connected"
    const pageIdToIndex = new Map<string, number>();
    allBusinessPages.forEach((p, i) => pageIdToIndex.set(p.id, i));
    allPages.forEach((page: any) => {
      const idx = pageIdToIndex.get(page.id);
      if (idx !== undefined && page.access_token) {
        allBusinessPages[idx] = { ...allBusinessPages[idx], access_token: page.access_token, picture: page.picture || allBusinessPages[idx].picture };
      }
    });

    // Include all direct pages (me/accounts) in allBusinessPages so "Pages by Business" tab always has data
    allPages.forEach((page: any) => {
      if (!pageIdToIndex.has(page.id)) {
        pageIdToIndex.set(page.id, allBusinessPages.length);
        allBusinessPages.push(page);
      }
    });

    // Add all ad accounts (including Personal) so "Accounts by Business" tab always has data
    allAccounts.forEach((acc: any) => {
      const bizName = acc.business_name || 'Personal Account';
      if (!seenBusinessAccountIds.has(acc.id)) {
        seenBusinessAccountIds.add(acc.id);
        allBusinessAccounts.push({ ...acc, business_name: bizName });
      }
    });
    // Merge full details from me/adaccounts into businessAccounts - so accounts with Access have complete data
    const accountIdToFull = new Map<string, any>();
    allAccounts.forEach((acc: any) => {
      accountIdToFull.set(acc.id, acc);
      if (acc.account_id) accountIdToFull.set(acc.account_id, acc);
    });
    allBusinessAccounts.forEach((acc, i) => {
      const full = accountIdToFull.get(acc.id) || accountIdToFull.get(acc.account_id);
      if (full) {
        allBusinessAccounts[i] = { ...acc, ...full, business_name: acc.business_name, hasDirectAccess: true };
      } else {
        allBusinessAccounts[i] = { ...acc, hasDirectAccess: false };
      }
    });

    const businesses = Array.from(allBusinessesMap.values());

    // === SUBSCRIPTION-BASED FILTERING ===
    // Pages/ad accounts for /inbox, /create-ads, /launch, /audiences, /tools/auto-rules,
    // /ads-manager/accounts (main tab), /ads-manager/campaigns, /ads-manager/google-sheets-export
    // use ONLY the selection from Settings > Manage Access. If nothing selected, return empty.
    // Exception: /ads-manager/accounts?tab=accounts-by-business and ?tab=pages-by-business
    // use unfiltered data (allBusinessPages, allBusinessAccountsUnfiltered).
    const pool = await getSubscriptionPool(user.id, session.user.email || undefined);
    const selectedPageIdsSet = new Set(pool.pageIds);
    const selectedAdAccountIdsSet = new Set(pool.adAccountIds.map(id => id.startsWith('act_') ? id : `act_${id}`));

    // Only return accounts that are selected in manage-access; if none selected, return empty
    const filteredAccounts = selectedAdAccountIdsSet.size > 0
      ? allAccounts.filter((acc: any) => {
        const accId = acc.id.startsWith('act_') ? acc.id : `act_${acc.id}`;
        return selectedAdAccountIdsSet.has(accId);
      })
      : [];

    // Only return pages that are selected in manage-access; if none selected, return empty
    let filteredPages: any[];
    if (selectedPageIdsSet.size > 0) {
      const teamPagesResult = await getTeamPagesForUser(user.id, session.user?.email ?? null);
      const teamPagesList = teamPagesResult.pages;
      const teamFiltered = teamPagesList.filter((page: any) => selectedPageIdsSet.has(page.id));
      const configFiltered = allPages.filter((page: any) => selectedPageIdsSet.has(page.id));
      const byId = new Map<string, any>();
      teamFiltered.forEach((p: any) => byId.set(p.id, p));
      configFiltered.forEach((p: any) => { if (!byId.has(p.id)) byId.set(p.id, p); });
      filteredPages = Array.from(byId.values());
    } else {
      filteredPages = [];
    }

    const filteredBusinessPages = selectedPageIdsSet.size > 0
      ? allBusinessPages.filter((page: any) => selectedPageIdsSet.has(page.id))
      : [];

    const filteredBusinessAccounts = selectedAdAccountIdsSet.size > 0
      ? allBusinessAccounts.filter((acc: any) => selectedAdAccountIdsSet.has(acc.id))
      : [];

    const responseData = {
      accounts: filteredAccounts,
      pages: filteredPages,
      businessPages: filteredBusinessPages,
      businessAccounts: filteredBusinessAccounts,
      businesses,
      // Unfiltered data for management pages (accounts-by-business, pages-by-business)
      allBusinessPages: allBusinessPages,
      allBusinessAccountsUnfiltered: allBusinessAccounts,
      // Pass subscription selections to AdAccountContext for auto-selection
      subscriptionSelectedPageIds: Array.from(selectedPageIdsSet),
      subscriptionSelectedAccountIds: Array.from(selectedAdAccountIdsSet),
    };

    memoryCache[cacheKeyBase] = { data: responseData, timestamp: Date.now() };
    await setCache(generateCacheKey('team:config', user.id), responseData, CACHE_TTL_SEC);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in /api/team/config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
}
