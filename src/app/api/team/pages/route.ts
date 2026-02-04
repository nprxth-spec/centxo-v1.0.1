import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Simple in-memory cache using globalThis to survive HMR in dev
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes - reduce Meta rate limit usage

declare global {
    var _pagesCache: Record<string, { data: any, timestamp: number }> | undefined;
}

const cache = globalThis._pagesCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._pagesCache = cache;

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
                console.log(`[team/pages] Serving from cache for user ${user.id}`);
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
            return NextResponse.json({ pages: [] });
        }

        // Fetch pages from all team members
        const allPages: any[] = [];

        // First, fetch all businesses to use for name resolution
        // Also map page IDs to the Business that has access to them
        const pageToBusinessMap = new Map();
        const businessMap = new Map();

        for (const member of teamMembers) {
            try {
                if (member.accessTokenExpires && new Date(member.accessTokenExpires) < new Date()) {
                    continue;
                }

                const bizResponse = await fetch(
                    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,client_pages{id,name}&limit=500&access_token=${member.accessToken}`
                );

                if (bizResponse.ok) {
                    const bizData = await bizResponse.json();
                    if (bizData.data && Array.isArray(bizData.data)) {
                        bizData.data.forEach((b: any) => {
                            businessMap.set(b.id, b.name);

                            // If this business has client pages (pages shared to it), map them
                            if (b.client_pages && b.client_pages.data) {
                                b.client_pages.data.forEach((p: any) => {
                                    pageToBusinessMap.set(p.id, b.name);
                                });
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(`Error fetching businesses for ${member.facebookName}:`, error);
            }
        }

        console.log(`[team/pages] Maps size - Business: ${businessMap.size}, Shared Pages: ${pageToBusinessMap.size}`);

        const seenPageIds = new Set<string>();

        for (const member of teamMembers) {
            try {
                // Check if token is still valid
                if (member.accessTokenExpires && new Date(member.accessTokenExpires) < new Date()) {
                    console.warn(`Token expired for team member: ${member.facebookName}`);
                    continue;
                }

                const token = member.accessToken;

                // 1. Fetch pages from me/accounts (user's direct pages)
                const response = await fetch(
                    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,picture,access_token,business&limit=500&access_token=${token}`
                );

                const data = await response.json();

                if (data.error) {
                    console.warn(`[team/pages] me/accounts error for ${member.facebookName}:`, data.error.message || data.error);
                }

                if (data.data && Array.isArray(data.data)) {
                    for (const page of data.data) {
                        if (seenPageIds.has(page.id)) continue;
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
                    }
                }

                // NOTE: Only use pages from me/accounts - these are the pages the user SELECTED
                // during the Facebook OAuth permission step. Do NOT add pages from businesses
                // (owned_pages, client_pages) - those would include all business pages, not
                // just the ones the user granted during connect.
            } catch (error) {
                console.error(`Error fetching pages for team member ${member.facebookName}:`, error);
            }
        }

        console.log(`[team/pages] Total pages found: ${allPages.length}`);

        const responseData = {
            pages: allPages,
            teamMembersCount: teamMembers.length,
        };

        // Save to cache
        cache[user.id] = {
            data: responseData,
            timestamp: Date.now()
        };

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error fetching team pages:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pages' },
            { status: 500 }
        );
    }
}
