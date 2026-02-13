import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCached, setCache, generateCacheKey, CacheTTL } from '@/lib/cache/redis';
import { getSubscriptionPool } from '@/lib/subscription-filter';

// 1 hour - reduce Meta API quota for 200+ users (Redis + in-memory fallback)
const CACHE_TTL_MS = 60 * 60 * 1000;

declare global {
    var _adAccountCache: Record<string, { data: any; timestamp: number }> | undefined;
}

const memoryCache = globalThis._adAccountCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._adAccountCache = memoryCache;

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check Cache
        const searchParams = req.nextUrl.searchParams;
        const forceRefresh = searchParams.get('refresh') === 'true';
        const mode = searchParams.get('mode'); // 'business' or undefined

        if (!forceRefresh) {
            const redisCached = await getCached<any>(generateCacheKey('team:ad-accounts', `${user.id}:${mode || 'default'}`));
            if (redisCached) return NextResponse.json(redisCached);

            const cached = memoryCache[`${user.id}_${mode || 'default'}`];
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
                return NextResponse.json(cached.data);
            }
        }

        // 1. Get ALL team facebook connections (Host + Members)
        const { getTeamFacebookConnections } = await import('@/lib/team-connections-server');
        const connections = await getTeamFacebookConnections(user.id, session.user.email);

        if (connections.length === 0) {
            return NextResponse.json({ accounts: [] });
        }

        const allAccounts: any[] = [];
        const seenAdAccountIds = new Set<string>();

        // Shared maps for resolution
        const businessMap = new Map();
        const businessIdToProfile = new Map<string, string>();
        const businessNameToProfile = new Map<string, string>();
        const adAccountToBusinessMap = new Map<string, { name: string; profilePictureUri?: string }>();

        // Helper: Generic paginated fetcher
        async function fetchPaginated(initialUrl: string, token: string): Promise<any[]> {
            const list: any[] = [];
            let url: string | null = initialUrl.includes('access_token=') ? initialUrl : `${initialUrl}${initialUrl.includes('?') ? '&' : '?'}access_token=${token}`;
            while (url) {
                const res: Response = await fetch(url);
                if (!res.ok) break;
                const json: any = await res.json();
                if (json.data) list.push(...json.data);
                url = json.paging?.next || null;
                // If the next URL doesn't have token but it's a relative one (rare in Meta), append it
                if (url && !url.includes('access_token=')) {
                    url = `${url}${url.includes('?') ? '&' : '?'}access_token=${token}`;
                }
            }
            return list;
        }

        async function fetchAllAdAccounts(token: string): Promise<any[]> {
            return fetchPaginated(
                `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,account_status,disable_reason,spend_cap,amount_spent,timezone_name,timezone_offset_hours_utc,business_country_code,business{id,name,profile_picture_uri},owner{id,name},funding_source_details,ads.filtering([{'field':'effective_status','operator':'IN','value':['ACTIVE']}]).limit(0).summary(true)&limit=500`,
                token
            );
        }

        // Step A: Intensive Discovery Phase (Businesses -> Owned/Client Accounts)
        for (const connection of connections) {
            try {
                if (!connection.accessToken) continue;

                // 1. Fetch ALL businesses
                const businesses = await fetchPaginated(
                    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,profile_picture_uri&limit=100`,
                    connection.accessToken
                );

                for (const b of businesses) {
                    businessMap.set(b.id, b.name);
                    if (b.profile_picture_uri) {
                        businessIdToProfile.set(b.id, b.profile_picture_uri);
                        businessNameToProfile.set(b.name, b.profile_picture_uri);
                    }

                    // 2. Fetch ALL owned ad accounts for this business
                    const ownedAccounts = await fetchPaginated(
                        `https://graph.facebook.com/v21.0/${b.id}/owned_ad_accounts?fields=id,name,account_id,currency,account_status,business,owner&limit=100`,
                        connection.accessToken
                    );

                    // 3. Fetch ALL client ad accounts for this business
                    const clientAccounts = await fetchPaginated(
                        `https://graph.facebook.com/v21.0/${b.id}/client_ad_accounts?fields=id,name,account_id,currency,account_status,business,owner&limit=100`,
                        connection.accessToken
                    );

                    const bizAdAccounts = [...ownedAccounts, ...clientAccounts];
                    bizAdAccounts.forEach((acc: any) => {
                        // Map details for subsequent resolution
                        adAccountToBusinessMap.set(acc.id, { name: b.name, profilePictureUri: b.profile_picture_uri });
                        adAccountToBusinessMap.set(acc.account_id, { name: b.name, profilePictureUri: b.profile_picture_uri });

                        if (!seenAdAccountIds.has(acc.id)) {
                            seenAdAccountIds.add(acc.id);
                            allAccounts.push({
                                ...acc,
                                business_name: b.name,
                                business_profile_picture_uri: b.profile_picture_uri,
                                _source: {
                                    teamMemberId: connection.source === 'teamMember' ? connection.id : '',
                                    facebookName: connection.facebookName,
                                    facebookUserId: connection.facebookUserId,
                                },
                            });
                        }
                    });
                }
            } catch (error) {
                console.error(`Error intensive-discovering for ${connection.facebookName}:`, error);
            }
        }

        // Step B: Personal/Direct Phase (me/adaccounts)
        for (const connection of connections) {
            try {
                if (!connection.accessToken) continue;
                const dataList = await fetchAllAdAccounts(connection.accessToken);
                dataList.forEach((account: any) => {
                    if (!seenAdAccountIds.has(account.id)) {
                        seenAdAccountIds.add(account.id);

                        let businessName = account.business?.name || account.owner?.name;
                        let businessProfilePictureUri: string | undefined = account.business?.profile_picture_uri;

                        if (!businessName && account.business?.id) businessName = businessMap.get(account.business.id);
                        if (!businessName) {
                            const bizShared = adAccountToBusinessMap.get(account.id) || adAccountToBusinessMap.get(account.account_id);
                            if (bizShared) {
                                businessName = bizShared.name;
                                businessProfilePictureUri = bizShared.profilePictureUri;
                            }
                        }

                        if (!businessName) businessName = 'Personal Account';
                        if (!businessProfilePictureUri && account.business?.id) businessProfilePictureUri = businessIdToProfile.get(account.business.id);
                        if (!businessProfilePictureUri && businessName) businessProfilePictureUri = businessNameToProfile.get(businessName);

                        allAccounts.push({
                            ...account,
                            business_name: businessName,
                            business_profile_picture_uri: businessProfilePictureUri,
                            _source: {
                                teamMemberId: connection.source === 'teamMember' ? connection.id : '',
                                facebookName: connection.facebookName,
                                facebookUserId: connection.facebookUserId,
                            },
                        });
                    }
                });
            } catch (error) {
                console.error(`Error fetching personal ad accounts for ${connection.facebookName}:`, error);
            }
        }

        let filteredAccounts = allAccounts;

        // Apply Subscription Pool filtering unless in business mode
        if (mode !== 'business') {
            const { adAccountIds } = await getSubscriptionPool(user.id, session.user.email);
            if (adAccountIds.length > 0) {
                // Meta IDs are often prepended with 'act_', subscription IDs might not be. Normalize comparison.
                const normalizedPool = adAccountIds.map(id => id.startsWith('act_') ? id : `act_${id}`);
                filteredAccounts = allAccounts.filter(acc => {
                    const accId = acc.id.startsWith('act_') ? acc.id : `act_${acc.id}`;
                    return normalizedPool.includes(accId);
                });
            }
        }

        const responseData = { accounts: filteredAccounts, teamMembersCount: connections.length };
        memoryCache[`${user.id}_${mode || 'default'}`] = { data: responseData, timestamp: Date.now() };
        await setCache(generateCacheKey('team:ad-accounts', `${user.id}:${mode || 'default'}`), responseData, CacheTTL.AD_ACCOUNTS);

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching team ad accounts:', error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}
