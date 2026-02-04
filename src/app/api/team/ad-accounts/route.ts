import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fromBasicUnits } from '@/lib/currency-utils';

// Simple in-memory cache using globalThis to survive HMR in dev
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes - reduce Meta rate limit usage

declare global {
    var _adAccountCache: Record<string, { data: any, timestamp: number }> | undefined;
}

const cache = globalThis._adAccountCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._adAccountCache = cache;

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get user and their team members
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                teamMembers: true,
            } as any,
        }) as any;

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check Cache
        const searchParams = req.nextUrl.searchParams;
        const forceRefresh = searchParams.get('refresh') === 'true';
        const cacheKey = `ad_accounts_v3_${user.id}`;

        if (!forceRefresh && cache[cacheKey]) {
            const cached = cache[cacheKey];
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log(`[team/ad-accounts] Serving from cache for user ${user.id}`);
                return NextResponse.json(cached.data);
            }
        }

        console.log(`[team/ad-accounts-debug] User: ${session.user.email} (ID: ${user.id})`);

        // Find ALL team members that belong to the same team
        // This includes finding the host and all members
        let teamMembers = await prisma.teamMember.findMany({
            where: {
                userId: user.id,
                memberType: 'facebook',
                facebookUserId: { not: null },
                accessToken: { not: null },
            },
        });

        console.log(`[team/ad-accounts-debug] Host check: Found ${teamMembers.length} members connected to user ${user.id}`);

        // If current user is not the host, find the host's team members
        if (teamMembers.length === 0) {
            console.log(`[team/ad-accounts-debug] User is not a host with facebook connection. Checking if they are a member...`);

            // Try to find if this user is a team member themselves
            const memberRecord = await prisma.teamMember.findFirst({
                where: {
                    memberEmail: session.user.email,
                },
                select: {
                    userId: true, // This is the host's user ID
                    id: true,
                    memberType: true
                },
            });

            if (memberRecord) {
                console.log(`[team/ad-accounts-debug] Found member record! Host ID: ${memberRecord.userId}, Member Record ID: ${memberRecord.id}, Type: ${memberRecord.memberType}`);

                // Get all team members under this host
                teamMembers = await prisma.teamMember.findMany({
                    where: {
                        userId: memberRecord.userId,
                        memberType: 'facebook',
                        facebookUserId: { not: null },
                        accessToken: { not: null },
                    },
                });
                console.log(`[team/ad-accounts-debug] Found ${teamMembers.length} facebook connections under host ${memberRecord.userId}`);
            } else {
                console.log(`[team/ad-accounts-debug] No member record found for email ${session.user.email}`);
            }
        }

        console.log('[team/ad-accounts] Found team members:', teamMembers.length);

        // If no team members, return empty
        if (teamMembers.length === 0) {
            return NextResponse.json({ accounts: [] });
        }

        // Fetch ad accounts from all team members
        const allAccounts: any[] = [];

        // First, fetch all businesses to use for name resolution
        const allBusinesses: any[] = [];
        for (const member of teamMembers) {
            try {
                if (!member.accessToken || (member.accessTokenExpires && new Date(member.accessTokenExpires) < new Date())) {
                    continue;
                }

                // Fetch businesses with profile_picture_uri for display in ads-manager
                const bizResponse = await fetch(
                    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,profile_picture_uri,client_ad_accounts{id,name,account_id}&limit=500&access_token=${member.accessToken}`
                );

                if (bizResponse.ok) {
                    const bizData = await bizResponse.json();
                    if (bizData.data && Array.isArray(bizData.data)) {
                        allBusinesses.push(...bizData.data);
                    }
                }
            } catch (error) {
                console.error(`Error fetching businesses for ${member.facebookName}:`, error);
            }
        }

        // Create a map of business ID to business name for quick lookup
        const businessMap = new Map();

        // Map business ID/name to profile picture URI
        const businessIdToProfile = new Map<string, string>();
        const businessNameToProfile = new Map<string, string>();

        // Also map ad account IDs to the Business that has access to them
        const adAccountToBusinessMap = new Map<string, { name: string; profilePictureUri?: string }>();

        allBusinesses.forEach(b => {
            businessMap.set(b.id, b.name);
            if (b.profile_picture_uri) {
                businessIdToProfile.set(b.id, b.profile_picture_uri);
                businessNameToProfile.set(b.name, b.profile_picture_uri);
            }

            // If this business has client ad accounts (accounts shared to it), map them
            if (b.client_ad_accounts && b.client_ad_accounts.data) {
                b.client_ad_accounts.data.forEach((acc: any) => {
                    adAccountToBusinessMap.set(acc.id, { name: b.name, profilePictureUri: b.profile_picture_uri });
                    adAccountToBusinessMap.set(acc.account_id, { name: b.name, profilePictureUri: b.profile_picture_uri });
                });
            }
        });

        console.log(`[team/ad-accounts] Business map size: ${businessMap.size}`);
        console.log(`[team/ad-accounts] Shared accounts map size: ${adAccountToBusinessMap.size}`);

        for (const member of teamMembers) {
            try {
                // Skip if no access token
                if (!member.accessToken) {
                    console.warn(`[team/ad-accounts] No access token for: ${member.facebookName || member.id}`);
                    continue;
                }

                // Check if token is still valid (if expiry date exists)
                if (member.accessTokenExpires && new Date(member.accessTokenExpires) < new Date()) {
                    console.warn(`[team/ad-accounts] Token expired for: ${member.facebookName || member.id}`);
                    // Note: Should implement token refresh or prompt user to reconnect
                    continue;
                }

                console.log(`[team/ad-accounts] Fetching ad accounts for: ${member.facebookName || member.id}`);

                // Fetch ad accounts from this team member's Facebook account
                const url = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,account_status,disable_reason,spend_cap,amount_spent,timezone_name,timezone_offset_hours_utc,business_country_code,business{id,name,profile_picture_uri},owner{id,name},funding_source_details,ads.filtering([{'field':'effective_status','operator':'IN','value':['ACTIVE']}]).limit(0).summary(true)&limit=500&access_token=${member.accessToken}`;
                const response = await fetch(url);

                if (!response.ok) {
                    console.error(`Failed to fetch ad accounts for ${member.facebookName}`);
                    continue;
                }

                const data = await response.json();

                if (data.data && Array.isArray(data.data)) {
                    // Add source info to each account and convert from basic units
                    const accountsWithSource = data.data.map((account: any) => {
                        const currency = account.currency || 'USD';
                        const spendCapInMainUnits = fromBasicUnits(account.spend_cap, currency);
                        const amountSpentInMainUnits = fromBasicUnits(account.amount_spent, currency);

                        // Determine business name or owner name
                        let businessName = account.business?.name || account.owner?.name;

                        // Get profile picture - prefer direct from ad account's business object
                        let businessProfilePictureUri: string | undefined = account.business?.profile_picture_uri;

                        // If business name is missing but we have business ID, look it up
                        if (!businessName && account.business?.id) {
                            businessName = businessMap.get(account.business.id);
                        }

                        // Check if this account is shared to a business (using our map)
                        if (!businessName) {
                            // Try matching with id (act_...) or account_id
                            const businessSharedTo = adAccountToBusinessMap.get(account.id) || adAccountToBusinessMap.get(account.account_id);
                            if (businessSharedTo) {
                                businessName = businessSharedTo.name;
                                businessProfilePictureUri = businessSharedTo.profilePictureUri;
                            }
                        }

                        // If still no name, use fallbacks
                        if (!businessName) {
                            if (account.owner?.id) {
                                // businessName = `(Owner ID: ${account.owner.id})`;
                                businessName = 'Personal Account';
                            } else if (account.business?.id) {
                                businessName = `(Biz ID: ${account.business.id})`;
                            } else if (account.owner) {
                                // If owner exists but has no name (just an ID string), it's a personal account
                                businessName = 'Personal Account';
                            } else {
                                businessName = 'Personal Account';
                                // businessName = 'Unknown Source';
                            }
                        }

                        // Resolve profile picture: from business ID, shared account, or business name
                        if (!businessProfilePictureUri && account.business?.id) {
                            businessProfilePictureUri = businessIdToProfile.get(account.business.id);
                        }
                        if (!businessProfilePictureUri && businessName) {
                            businessProfilePictureUri = businessNameToProfile.get(businessName);
                        }

                        return {
                            ...account,
                            // Flatten business name for frontend
                            business_name: businessName,
                            business_profile_picture_uri: businessProfilePictureUri,
                            // Convert from basic units (cents/satang/yen) to main units (dollars/baht/yen)
                            spend_cap: spendCapInMainUnits,
                            amount_spent: amountSpentInMainUnits,
                            _source: {
                                teamMemberId: member.id,
                                facebookName: member.facebookName,
                                facebookUserId: member.facebookUserId,
                            },
                        };
                    });

                    allAccounts.push(...accountsWithSource);
                }
            } catch (error) {
                console.error(`Error fetching ad accounts for team member ${member.facebookName}:`, error);
            }
        }

        const responseData = {
            accounts: allAccounts,
            teamMembersCount: teamMembers.length,
        };

        // Save to cache (use same key as read)
        cache[cacheKey] = {
            data: responseData,
            timestamp: Date.now()
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Error fetching team ad accounts:', error);
        return NextResponse.json(
            { error: 'Failed to fetch ad accounts' },
            { status: 500 }
        );
    }
}
