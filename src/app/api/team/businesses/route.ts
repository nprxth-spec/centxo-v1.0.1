import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Simple in-memory cache using globalThis to survive HMR in dev
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes - reduce Meta rate limit usage

declare global {
    var _businessCache: Record<string, { data: any, timestamp: number }> | undefined;
}

const cache = globalThis._businessCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._businessCache = cache;

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

        // Check Cache
        const searchParams = req.nextUrl.searchParams;
        const forceRefresh = searchParams.get('refresh') === 'true';
        const cacheKey = user.id;

        if (!forceRefresh && cache[cacheKey]) {
            const cached = cache[cacheKey];
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log(`[team/businesses] Serving from cache for user ${user.id}`);
                return NextResponse.json(cached.data);
            }
        }

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

        // If current user is not the host, find the host's team members
        if (teamMembers.length === 0) {
            // Try to find if this user is a team member themselves
            const memberRecord = await prisma.teamMember.findFirst({
                where: {
                    memberEmail: session.user.email,
                },
                select: {
                    userId: true, // This is the host's user ID
                },
            });

            if (memberRecord) {
                // Get all team members under this host
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

        // If no team members, return empty
        if (teamMembers.length === 0) {
            return NextResponse.json({ businesses: [] });
        }

        // Fetch businesses from all team members
        const allBusinesses: any[] = [];

        for (const member of teamMembers) {
            try {
                // Check if token is still valid
                if (member.accessTokenExpires && new Date(member.accessTokenExpires) < new Date()) {
                    console.warn(`Token expired for team member: ${member.facebookName}`);
                    continue;
                }

                // Fetch businesses from this team member's Facebook account
                const response = await fetch(
                    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,profile_picture_uri,verification_status,permitted_roles,permitted_tasks&limit=500&access_token=${member.accessToken}`
                );

                if (!response.ok) {
                    console.error(`Failed to fetch businesses for ${member.facebookName}`);
                    continue;
                }

                const data = await response.json();

                if (data.data && Array.isArray(data.data)) {
                    // Add source info to each business
                    const businessesWithSource = data.data.map((business: any) => {
                        console.log(`[businesses] ${business.name}: permitted_roles =`, business.permitted_roles, ', permitted_tasks =', business.permitted_tasks);
                        return {
                            ...business,
                            _source: {
                                teamMemberId: member.id,
                                facebookName: member.facebookName,
                                facebookUserId: member.facebookUserId,
                            },
                        };
                    });

                    allBusinesses.push(...businessesWithSource);
                }
            } catch (error) {
                console.error(`Error fetching businesses for team member ${member.facebookName}:`, error);
            }
        }

        const responseData = {
            businesses: allBusinesses,
            teamMembersCount: teamMembers.length,
        };

        // Save to cache
        cache[user.id] = {
            data: responseData,
            timestamp: Date.now()
        };

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching team businesses:', error);
        return NextResponse.json(
            { error: 'Failed to fetch businesses' },
            { status: 500 }
        );
    }
}
