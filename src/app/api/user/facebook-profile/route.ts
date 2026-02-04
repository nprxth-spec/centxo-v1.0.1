import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Cache to reduce Meta API calls (gr:get:User is heavily used)
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
declare global {
  var _facebookProfileCache: Record<string, { data: any; timestamp: number }> | undefined;
}
const cache = globalThis._facebookProfileCache ?? {};
if (process.env.NODE_ENV !== 'production') globalThis._facebookProfileCache = cache;

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get current user
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

        // Try to get Facebook data from MetaAccount first
        const metaAccount = await prisma.metaAccount.findUnique({
            where: { userId: user.id },
            select: {
                metaUserId: true,
                accessToken: true,
            },
        });

        const cacheKey = `profile_${user.id}`;
        const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';
        const cached = !forceRefresh && cache[cacheKey];
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return NextResponse.json(cached.data);
        }

        if (metaAccount?.metaUserId && metaAccount?.accessToken) {
            try {
                // Fetch Facebook profile name and picture from Graph API
                const response = await fetch(
                    `https://graph.facebook.com/${metaAccount.metaUserId}?fields=name,picture.type(large)&access_token=${metaAccount.accessToken}`
                );
                const fbData = await response.json();
                
                if (fbData.name) {
                    const result = { name: fbData.name, userId: metaAccount.metaUserId, pictureUrl: fbData.picture?.data?.url || null };
                    cache[cacheKey] = { data: result, timestamp: Date.now() };
                    return NextResponse.json(result);
                }
            } catch (error) {
                console.error('Error fetching from Facebook API:', error);
            }
        }

        // Fallback to Account table (NextAuth)
        const account = await prisma.account.findFirst({
            where: {
                userId: user.id,
                provider: 'facebook',
            },
            select: {
                providerAccountId: true,
                access_token: true,
            },
        });

        if (account?.providerAccountId) {
            // Try to get name from Facebook Graph API
            if (account.access_token) {
                try {
                    const response = await fetch(
                        `https://graph.facebook.com/${account.providerAccountId}?fields=name,picture.type(large)&access_token=${account.access_token}`
                    );
                    const fbData = await response.json();
                    
                    if (fbData.name) {
                        const result = { name: fbData.name, userId: account.providerAccountId, pictureUrl: fbData.picture?.data?.url || null };
                        cache[cacheKey] = { data: result, timestamp: Date.now() };
                        return NextResponse.json(result);
                    }
                } catch (error) {
                    console.error('Error fetching from Facebook API:', error);
                }
            }
            
            // Final fallback to session name
            const userName = session.user.name || 'Facebook User';
            return NextResponse.json({
                name: userName,
                userId: account.providerAccountId,
                pictureUrl: null,
            });
        }

        // Last resort: Check TeamMember table for user's own Facebook account
        const teamMember = await prisma.teamMember.findFirst({
            where: {
                userId: user.id,
                memberType: 'facebook',
                facebookUserId: { not: null },
            },
            select: {
                facebookUserId: true,
                facebookName: true,
                accessToken: true,
            },
        });

        if (teamMember?.facebookUserId) {
            // Try to fetch picture if we have access token
            let pictureUrl = null;
            if (teamMember.accessToken) {
                try {
                    const response = await fetch(
                        `https://graph.facebook.com/${teamMember.facebookUserId}?fields=picture.type(large)&access_token=${teamMember.accessToken}`
                    );
                    const fbData = await response.json();
                    pictureUrl = fbData.picture?.data?.url || null;
                } catch (error) {
                    console.error('Error fetching picture from TeamMember:', error);
                }
            }

            const result = { name: teamMember.facebookName || session.user.name || 'Facebook User', userId: teamMember.facebookUserId, pictureUrl };
            cache[cacheKey] = { data: result, timestamp: Date.now() };
            return NextResponse.json(result);
        }

        return NextResponse.json(
            { error: 'No Facebook account found' },
            { status: 404 }
        );
    } catch (error) {
        console.error('Error fetching Facebook profile:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Facebook profile' },
            { status: 500 }
        );
    }
}
