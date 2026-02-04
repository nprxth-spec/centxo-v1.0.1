import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fromBasicUnits } from '@/lib/currency-utils';
import { decryptToken } from '@/lib/services/metaClient';

/**
 * Combined API: ad accounts + pages + businesses in one request.
 * Uses same team resolution and tokens - ensures consistency.
 * REDUCES Meta API calls: 3 per member (businesses, adaccounts, accounts) vs 6+ when called separately.
 */
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes - reduce rate limit usage

declare global {
  var _teamConfigCache: Record<string, { data: any; timestamp: number }> | undefined;
}

const cache = globalThis._teamConfigCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._teamConfigCache = cache;

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

    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const cacheKey = `config_v10_${user.id}`; // v10: + MetaAccount fallback when no TeamMembers

    if (!forceRefresh && cache[cacheKey]) {
      const cached = cache[cacheKey];
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }
    }

    // Resolve team members (same logic as ad-accounts)
    let teamMembers = await prisma.teamMember.findMany({
      where: {
        userId: user.id,
        memberType: 'facebook',
        facebookUserId: { not: null },
        accessToken: { not: null },
      },
    });

    if (teamMembers.length === 0) {
      const memberRecord = await prisma.teamMember.findFirst({
        where: { memberEmail: session.user.email },
        select: { userId: true },
      });
      if (memberRecord) {
        teamMembers = await prisma.teamMember.findMany({
          where: {
            userId: memberRecord.userId,
            memberType: 'facebook',
            facebookUserId: { not: null },
            accessToken: { not: null },
          },
        });
      }
    }

    // Fallback: use MetaAccount when no TeamMembers (user connected via Meta OAuth or NextAuth Facebook)
    if (teamMembers.length === 0) {
      const metaAccount = await prisma.metaAccount.findUnique({
        where: { userId: user.id },
      });
      if (metaAccount?.accessToken && metaAccount.accessTokenExpires && new Date(metaAccount.accessTokenExpires) > new Date()) {
        let token: string;
        try {
          token = decryptToken(metaAccount.accessToken);
        } catch {
          token = metaAccount.accessToken; // May be unencrypted (legacy)
        }
        teamMembers = [
          {
            id: metaAccount.id,
            accessToken: token,
            accessTokenExpires: metaAccount.accessTokenExpires,
            facebookUserId: metaAccount.metaUserId,
            facebookName: session.user?.name || 'Main Account',
          } as any,
        ];
      }
    }

    if (teamMembers.length === 0) {
      const empty = { accounts: [], pages: [], businessPages: [], businessAccounts: [], businesses: [] };
      cache[cacheKey] = { data: empty, timestamp: Date.now() };
      return NextResponse.json(empty);
    }

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

    const bizFields = 'id,name,profile_picture_uri,verification_status,permitted_roles,permitted_tasks,client_ad_accounts.limit(500){id,name,account_id,account_status},client_pages.limit(500){id,name,picture,is_published},owned_pages.limit(500){id,name,picture,is_published}';

    for (const member of teamMembers) {
      if (!member.accessToken || (member.accessTokenExpires && new Date(member.accessTokenExpires) < new Date())) {
        continue;
      }

      const token = member.accessToken;

      // Fetch all with pagination
      const [bizResult, accountsResult, pagesResult] = await Promise.all([
        fetchAllPaginated(
          `https://graph.facebook.com/v21.0/me/businesses?fields=${encodeURIComponent(bizFields)}&limit=500&access_token=${token}`,
          token
        ),
        fetchAllPaginated(
          `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,account_status,disable_reason,spend_cap,amount_spent,timezone_name,timezone_offset_hours_utc,business_country_code,business{id,name,profile_picture_uri},owner{id,name},funding_source_details&limit=500&access_token=${token}`,
          token
        ),
        fetchAllPaginated(
          `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,picture,access_token,business&limit=500&access_token=${token}`,
          token
        ),
      ]);

      // Process businesses - also paginate nested client_pages, owned_pages, client_ad_accounts
      for (const b of bizResult.data) {
        businessMap.set(b.id, b.name);
        if (b.profile_picture_uri) businessIdToProfile.set(b.id, b.profile_picture_uri);
        const { client_pages, owned_pages, client_ad_accounts, ...bizWithoutPages } = b;
        allBusinessesMap.set(b.id, {
          ...bizWithoutPages,
          _source: {
            teamMemberId: member.id,
            facebookName: member.facebookName,
            facebookUserId: member.facebookUserId,
          },
        });

        const addAccount = (acc: any) => {
          adAccountToBusinessMap.set(acc.id, { name: b.name, profilePictureUri: b.profile_picture_uri });
          adAccountToBusinessMap.set(acc.account_id, { name: b.name, profilePictureUri: b.profile_picture_uri });
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
        if (client_ad_accounts?.data) {
          client_ad_accounts.data.forEach(addAccount);
          let accNext = client_ad_accounts.paging?.next;
          while (accNext) {
            const accRes = await fetch(accNext.includes('access_token=') ? accNext : `${accNext}${accNext.includes('?') ? '&' : '?'}access_token=${token}`);
            if (!accRes.ok) break;
            const accJson = await accRes.json();
            if (accJson.data) accJson.data.forEach(addAccount);
            accNext = accJson.paging?.next || null;
          }
        }

        const addPageToBusinessPages = (p: any) => {
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
        const fetchAllNestedPages = async (edge: { data?: any[]; paging?: { next?: string } } | undefined) => {
          if (!edge?.data) return;
          edge.data.forEach(addPageToBusinessPages);
          let next = edge.paging?.next;
          while (next) {
            const res = await fetch(next.includes('access_token=') ? next : `${next}${next.includes('?') ? '&' : '?'}access_token=${token}`);
            if (!res.ok) break;
            const json = await res.json();
            if (json.data) json.data.forEach(addPageToBusinessPages);
            next = json.paging?.next || null;
          }
        };
        await fetchAllNestedPages(client_pages);
        await fetchAllNestedPages(owned_pages);
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

    // Add accounts from me/adaccounts that have business_name (may not be in client_ad_accounts)
    allAccounts.forEach((acc: any) => {
      const bizName = acc.business_name || 'Personal Account';
      if (bizName !== 'Personal Account' && !seenBusinessAccountIds.has(acc.id)) {
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
        allBusinessAccounts[i] = { ...acc, ...full, business_name: acc.business_name };
      }
    });

    const businesses = Array.from(allBusinessesMap.values());

    const responseData = {
      accounts: allAccounts,
      pages: allPages,
      businessPages: allBusinessPages,
      businessAccounts: allBusinessAccounts,
      businesses,
    };

    cache[cacheKey] = { data: responseData, timestamp: Date.now() };
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in /api/team/config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
}
