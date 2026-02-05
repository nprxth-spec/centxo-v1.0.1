import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';
import { getCached, setCache, generateCacheKey, CacheTTL } from '@/lib/cache/redis';

// Cache: Redis + in-memory fallback - reduce gr:get:User per member
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 min
declare global {
  var _facebookPicturesCache: Record<string, { data: any; timestamp: number }> | undefined;
}
const memoryCache = globalThis._facebookPicturesCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._facebookPicturesCache = memoryCache;

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get team members with Facebook accounts
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

        // Check if user is a team member of another team
        const membershipTeam = await prisma.teamMember.findFirst({
            where: {
                memberEmail: session.user.email,
                memberType: 'email',
            },
        });

        let targetUserId = user.id;
        if (membershipTeam) {
            targetUserId = membershipTeam.userId;
        }

        const cacheKeyBase = `pictures_${targetUserId}`;
        const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';

        // Try Redis first (shared across instances for 200+ users)
        if (!forceRefresh) {
            const redisCached = await getCached<any>(generateCacheKey('team:facebook-pictures', targetUserId));
            if (redisCached) {
                return NextResponse.json(redisCached);
            }
        }

        if (!forceRefresh && memoryCache[cacheKeyBase] && Date.now() - memoryCache[cacheKeyBase].timestamp < CACHE_TTL_MS) {
            return NextResponse.json(memoryCache[cacheKeyBase].data);
        }

        // Get all Facebook team members
        const allMembers = await prisma.teamMember.findMany({
            where: {
                userId: targetUserId,
            },
        });

        const teamMembers = allMembers.filter(m => m.memberType === 'facebook' && m.facebookUserId);

        const membersWithTokens: Array<{ id: string; facebookUserId: string; facebookName: string | null; token: string }> = [];

        for (const m of teamMembers) {
            if (!m.facebookUserId || !m.accessToken) continue;
            membersWithTokens.push({
                id: m.id,
                facebookUserId: m.facebookUserId,
                facebookName: m.facebookName,
                token: m.accessToken,
            });
        }

        const metaAccount = await prisma.metaAccount.findUnique({
            where: { userId: targetUserId },
        });
        if (metaAccount?.metaUserId && metaAccount?.accessToken && metaAccount.accessTokenExpires && new Date(metaAccount.accessTokenExpires) > new Date()) {
            let token: string;
            try {
                token = decryptToken(metaAccount.accessToken);
            } catch {
                token = metaAccount.accessToken;
            }
            membersWithTokens.push({
                id: `meta-${metaAccount.id}`,
                facebookUserId: metaAccount.metaUserId,
                facebookName: null,
                token,
            });
        }

        const membersWithPictures = await Promise.all(
            membersWithTokens.map(async (member) => {
                let pictureUrl: string | null = null;
                try {
                    const res = await fetch(
                        `https://graph.facebook.com/v22.0/${member.facebookUserId}?fields=name,picture.type(large)&access_token=${member.token}`
                    );
                    const data = await res.json();
                    pictureUrl = data.picture?.data?.url || null;
                } catch (error) {
                    console.error(`Error fetching picture for ${member.id}:`, error);
                }
                return {
                    id: member.id,
                    userId: member.facebookUserId,
                    name: member.facebookName,
                    pictureUrl,
                };
            })
        );

        const result = { members: membersWithPictures };
        memoryCache[cacheKeyBase] = { data: result, timestamp: Date.now() };
        await setCache(generateCacheKey('team:facebook-pictures', targetUserId), result, CacheTTL.TEAM_FACEBOOK_PICTURES);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching team member pictures:', error);
        return NextResponse.json(
            { error: 'Failed to fetch team member pictures' },
            { status: 500 }
        );
    }
}
