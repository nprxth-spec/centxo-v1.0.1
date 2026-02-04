
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

// Helper to patch BigInt for JSON.stringify in this scope if needed, 
// though we handle it manually. Just a safety net for console logs.
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

export const maxDuration = 300; // Allow 5 minutes for sync

// Seed keywords to cover a broad range of interests
const SEED_KEYWORDS = [
    'Business', 'Marketing', 'Shopping', 'Fashion', 'Beauty', 'Skin care',
    'Food', 'Drink', 'Technology', 'Computers', 'Family', 'Relationships',
    'Fitness', 'Wellness', 'Sports', 'Outdoors', 'Travel', 'Holidays',
    'Music', 'Movies', 'Entertainment', 'Games', 'Reading', 'Science',
    'Vehicles', 'Cars', 'Home', 'Garden', 'Pets', 'Dogs', 'Cats',
    'Investment', 'Real estate', 'Design', 'Art', 'Photography',
    'Education', 'Career', 'Social media', 'News', 'Politics',
    'Luxury', 'Boutique', 'Discount', 'Sale', 'Online', 'Digital',
    'Mobile', 'Software', 'Hardware', 'Cosmetics', 'Spa', 'Clinic'
];

async function fetchInterests(keyword: string, accessToken: string, locale: string = 'th_TH') {
    try {
        const url = `https://graph.facebook.com/v22.0/search?type=adinterest&q=${encodeURIComponent(keyword)}&limit=1000&locale=${locale}&access_token=${accessToken}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CentxoAi/1.0 (Compatible; Business Tool)',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`FB API Error for ${keyword} (${locale}): ${response.status} ${text}`);
            return [];
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`Error fetching for ${keyword} (${locale}):`, error);
        return [];
    }
}

async function fetchBilingualInterests(keyword: string, accessToken: string) {
    // Fetch both Thai and English versions
    const [thaiResults, englishResults] = await Promise.all([
        fetchInterests(keyword, accessToken, 'th_TH'),
        fetchInterests(keyword, accessToken, 'en_US')
    ]);

    // Create a map to merge by fbId
    const mergedMap = new Map();

    // Add Thai results
    thaiResults.forEach((item: any) => {
        mergedMap.set(item.id, {
            fbId: item.id,
            nameTH: item.name,
            nameEN: null,
            audienceSizeLowerBound: item.audience_size_lower_bound,
            audienceSizeUpperBound: item.audience_size_upper_bound,
            path: item.path,
            topic: item.topic
        });
    });

    // Merge English results
    englishResults.forEach((item: any) => {
        if (mergedMap.has(item.id)) {
            const existing = mergedMap.get(item.id);
            existing.nameEN = item.name;
        } else {
            mergedMap.set(item.id, {
                fbId: item.id,
                nameTH: null,
                nameEN: item.name,
                audienceSizeLowerBound: item.audience_size_lower_bound,
                audienceSizeUpperBound: item.audience_size_upper_bound,
                path: item.path,
                topic: item.topic
            });
        }
    });

    return Array.from(mergedMap.values());
}

export async function GET(request: NextRequest) {
    return POST(request);
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        console.log('[Interest Sync] Starting sync for user:', session?.user?.email, 'ID:', session?.user?.id);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Try MetaAccount table first (most reliable - Persistent Business Connection)
        const metaAccount = await prisma.metaAccount.findUnique({
            where: { userId: session.user.id },
            select: { accessToken: true },
        });
        let accessToken = metaAccount?.accessToken;

        // 2. Fallback: Try session token
        if (!accessToken) {
            accessToken = (session as any).accessToken;
        }

        // 3. Fallback: Try Account table (NextAuth generic connection)
        if (!accessToken) {
            const account = await prisma.account.findFirst({
                where: {
                    userId: session.user.id,
                    provider: 'facebook',
                }
            });
            accessToken = account?.access_token || undefined;
        }

        // 4. Fallback: Try TeamMember table (New "Team" connection model)
        if (!accessToken) {
            // Find valid token from user's team members
            const userWithTeam: any = await (prisma as any).user.findUnique({
                where: { id: session.user.id },
                include: { teamMembers: true }
            });

            if (userWithTeam?.teamMembers && userWithTeam.teamMembers.length > 0) {
                // Use the most recently added member's token
                const newestMember = userWithTeam.teamMembers.sort((a: any, b: any) =>
                    new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
                )[0];
                accessToken = newestMember.accessToken;
            }
        }

        // 5. SUPER ADMIN SYSTEM FALLBACK
        // If the user is a Super Admin but hasn't linked their own Facebook, 
        // try to find ANY valid token in the system to perform the sync.
        // This is acceptable for Public Interest Search which doesn't require specific user context.
        if (!accessToken && (session.user as any).role === 'SUPER_ADMIN') {
            console.log('Super Admin Sync: attempting to find system fallback token...');

            // Try TeamMember table first (most likely to have fresh tokens)
            const anyTeamMember: any = await (prisma as any).teamMember.findFirst({
                orderBy: { addedAt: 'desc' }
            });

            if (anyTeamMember?.accessToken) {
                console.log('Super Admin: Using token from TeamMember:', anyTeamMember.facebookName);
                accessToken = anyTeamMember.accessToken;
            } else {
                // Try newest MetaAccount
                const systemMetaAccount = await prisma.metaAccount.findFirst({
                    orderBy: { updatedAt: 'desc' },
                    select: { accessToken: true }
                });

                if (systemMetaAccount?.accessToken) {
                    accessToken = systemMetaAccount.accessToken;
                } else {
                    // Try newest Account
                    const systemAccount = await prisma.account.findFirst({
                        where: { provider: 'facebook' },
                        orderBy: { id: 'desc' }, // Account doesn't always have updatedAt
                        select: { access_token: true }
                    });
                    accessToken = systemAccount?.access_token || undefined;
                }
            }
        }

        if (!accessToken) {
            return NextResponse.json({
                error: 'Facebook Access Token not found.',
                details: 'System has no active Facebook connections. At least one user must connect Facebook to the platform.'
            }, { status: 400 });
        }

        let totalSynced = 0;
        let errors = 0;

        // 5. MAX LIMIT per run to avoid "Unusual Activity" (e.g. 50 calls is too many, do 10-15)
        const MAX_KEYWORDS_PER_RUN = 10;
        const keywordsToProcess = SEED_KEYWORDS.slice(0, MAX_KEYWORDS_PER_RUN);
        // In a real app, we would rotate through SEED_KEYWORDS using cursor/pagination in DB
        // For now, let's just do the first 10. The user can click again if we implement rotation later,
        // but for safety, small batches are better.
        // Or pick random 10? Random is safer to avoid always hitting "Business" first.
        const shuffled = SEED_KEYWORDS.sort(() => 0.5 - Math.random()).slice(0, MAX_KEYWORDS_PER_RUN);

        console.log(`Starting SAFE Sync for ${shuffled.length} keywords...`);

        // Process sequentially (NO Promise.all)
        for (const keyword of shuffled) {
            try {
                // Add random delay BEFORE request (2s - 5s)
                const delay = Math.floor(Math.random() * 3000) + 2000;
                await new Promise(r => setTimeout(r, delay));

                const interests = await fetchBilingualInterests(keyword, accessToken);

                for (const item of interests) {
                    try {
                        const lower = BigInt(item.audienceSizeLowerBound || 0);
                        const upper = BigInt(item.audienceSizeUpperBound || 0);

                        await (prisma as any).facebookInterest.upsert({
                            where: { fbId: item.fbId },
                            update: {
                                name: item.nameEN || item.nameTH || 'Unknown',
                                nameTH: item.nameTH,
                                nameEN: item.nameEN,
                                audienceSizeLowerBound: lower,
                                audienceSizeUpperBound: upper,
                                path: item.path ? JSON.stringify(item.path) : undefined,
                                topic: item.topic,
                            },
                            create: {
                                fbId: item.fbId,
                                name: item.nameEN || item.nameTH || 'Unknown',
                                nameTH: item.nameTH,
                                nameEN: item.nameEN,
                                audienceSizeLowerBound: lower,
                                audienceSizeUpperBound: upper,
                                path: item.path ? JSON.stringify(item.path) : undefined,
                                topic: item.topic,
                            }
                        });
                        totalSynced++;
                    } catch (dbError) {
                        // Silent fail for duplicates/db issues to keep flow safe
                    }
                }
            } catch (e) {
                errors++;
            }
        }


        await createAuditLog({
            userId: session.user.id,
            action: 'SYNC_INTERESTS',
            details: { count: totalSynced, errors: errors }
        });

        return NextResponse.json({
            success: true,
            message: `Synced ${totalSynced} interests successfully.`,
            count: totalSynced
        });

    } catch (error: any) {
        console.error('Fatal Sync failed:', error);

        await createAuditLog({
            action: 'API_ERROR',
            entityType: 'InterestSync',
            details: { error: error.message }
        });

        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message
        }, { status: 500 });
    }
}
