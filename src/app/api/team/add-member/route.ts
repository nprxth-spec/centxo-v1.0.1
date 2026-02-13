import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFacebookAccountLimit } from '@/lib/plan-limits';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email || !session.user.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { email: true, plan: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Identify Host
        let hostId = session.user.id;
        let isAdmin = false;

        const membership = await prisma.teamMember.findFirst({
            where: { memberEmail: user.email, memberType: 'email' },
            include: { user: { select: { plan: true } } }
        });

        if (membership) {
            if (membership.role !== 'ADMIN') {
                return NextResponse.json({ error: 'Only Admins or the Team Owner can add members' }, { status: 403 });
            }
            hostId = membership.userId;
            isAdmin = true;
        }

        const hostPlan = membership?.user?.plan || user.plan || 'FREE';
        const { getFacebookAccountLimit } = await import('@/lib/plan-limits');
        const limit = getFacebookAccountLimit(hostPlan);

        const facebookMemberCount = await prisma.teamMember.count({
            where: { userId: hostId, memberType: 'facebook' },
        });

        if (facebookMemberCount >= limit) {
            return NextResponse.json(
                { error: `The team plan allows up to ${limit} Facebook account(s). Please upgrade to add more.`, limitReached: true },
                { status: 403 }
            );
        }

        // Get optional returnTo parameter
        const { searchParams } = new URL(req.url);
        const returnTo = searchParams.get('returnTo') || '/settings?tab=team';

        // Generate state token with user ID for security
        const state = Buffer.from(JSON.stringify({
            userId: session.user.id,
            timestamp: Date.now(),
            returnTo,
        })).toString('base64');

        // Build Facebook OAuth URL for team member
        const params = new URLSearchParams({
            client_id: process.env.FACEBOOK_APP_ID || '',
            redirect_uri: `${process.env.NEXTAUTH_URL}/api/team/callback`,
            state,
            scope: 'email,public_profile,ads_read,ads_management,pages_read_engagement,pages_show_list,pages_messaging,pages_manage_metadata,pages_manage_ads,business_management',
            auth_type: 'reauthorize',
        });

        const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;

        return NextResponse.json({
            authUrl,
            state,
        });
    } catch (error) {
        console.error('Error initiating team member OAuth:', error);
        return NextResponse.json(
            { error: 'Failed to initiate OAuth' },
            { status: 500 }
        );
    }
}
