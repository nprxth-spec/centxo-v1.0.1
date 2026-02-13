import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTeamPagesForUser } from '@/lib/team-pages-server';
import { getCached, setCache, generateCacheKey, CacheTTL } from '@/lib/cache/redis';
import { getSubscriptionPool } from '@/lib/subscription-filter';

// 1 hour - reduce Meta rate limit (gr:get:User/accounts, gr:get:User/businesses)
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_TTL_SEC = CacheTTL.TEAM_CONFIG;

declare global {
    var _pagesCache: Record<string, { data: any, timestamp: number }> | undefined;
}

const memoryCache = globalThis._pagesCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._pagesCache = memoryCache;

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check Cache (Redis first, then in-memory)
        const searchParams = req.nextUrl.searchParams;
        const forceRefresh = searchParams.get('refresh') === 'true';
        const mode = searchParams.get('mode'); // 'business' or undefined
        const cacheKeyBase = `pages_v1_${user.id}_${mode || 'default'}`;

        if (!forceRefresh) {
            const redisCached = await getCached<any>(generateCacheKey('team:pages', `${user.id}:${mode || 'default'}`));
            if (redisCached) {
                return NextResponse.json(redisCached);
            }
        }

        if (!forceRefresh && memoryCache[cacheKeyBase]) {
            const cached = memoryCache[cacheKeyBase];
            if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
                return NextResponse.json(cached.data);
            }
        }

        const result = await getTeamPagesForUser(user.id, session.user.email);
        let allPages = result.pages;

        // Apply Subscription Pool filtering unless in business mode
        if (mode !== 'business') {
            const { pageIds } = await getSubscriptionPool(user.id, session.user.email);
            if (pageIds.length > 0) {
                allPages = allPages.filter(p => pageIds.includes(p.id));
            }
        }

        const responseData = {
            pages: allPages,
            teamMembersCount: allPages.length ? 1 : 0,
            hint: result.hint,
        };

        // Save to cache (Redis + in-memory) — only cache when pages found (don't cache empty results)
        if (allPages.length > 0) {
            await setCache(generateCacheKey('team:pages', `${user.id}:${mode || 'default'}`), responseData, CACHE_TTL_SEC);
            memoryCache[cacheKeyBase] = { data: responseData, timestamp: Date.now() };
        } else {
            // Clear stale cache if pages are empty (e.g. user just connected Facebook)
            delete memoryCache[cacheKeyBase];
        }

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching team pages:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pages' },
            { status: 500 }
        );
    }
}
