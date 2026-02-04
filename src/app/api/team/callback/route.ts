import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
            return NextResponse.redirect(new URL('/settings?section=team&error=missing_params', req.url));
        }

        // Decode state to get user ID and returnTo
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const userId = stateData.userId;
        const returnTo = stateData.returnTo || '/settings?section=team';

        // Exchange code for access token
        const tokenResponse = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.FACEBOOK_APP_ID,
                client_secret: process.env.FACEBOOK_APP_SECRET,
                redirect_uri: `${process.env.NEXTAUTH_URL}/api/team/callback`,
                code,
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to exchange code for token');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const expiresIn = tokenData.expires_in || 5184000; // Default 60 days

        // Get Facebook user info
        const userResponse = await fetch(
            `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`
        );

        if (!userResponse.ok) {
            throw new Error('Failed to fetch Facebook user info');
        }

        const fbUser = await userResponse.json();

        // Resolve correct team owner (Host ID)
        // If the current user is a member of another team, add the FB account to THAT team.
        const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true }
        });

        let targetHostId = userId;

        if (userRecord && userRecord.email) {
            const teamMembership = await prisma.teamMember.findFirst({
                where: {
                    memberEmail: userRecord.email,
                    memberType: 'email'
                }
            });

            if (teamMembership) {
                targetHostId = teamMembership.userId;
            }
        }

        // Create or Update team member (Upsert)
        // This handles cases where the account was previously added to the wrong team (ghost account)
        // or just needs token refresh. "Latest login wins" policy.
        await prisma.teamMember.upsert({
            where: {
                facebookUserId: fbUser.id,
            },
            update: {
                userId: targetHostId, // Update owner to correct Host (moves account if needed)
                facebookName: fbUser.name,
                facebookEmail: fbUser.email,
                accessToken,
                accessTokenExpires: new Date(Date.now() + expiresIn * 1000),
                role: 'MEMBER',
                updatedAt: new Date(),
            },
            create: {
                userId: targetHostId,
                facebookUserId: fbUser.id,
                facebookName: fbUser.name,
                facebookEmail: fbUser.email,
                accessToken,
                accessTokenExpires: new Date(Date.now() + expiresIn * 1000),
                role: 'MEMBER',
            },
        });

        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
            userId: targetHostId,
            action: 'TEAM_ADD_MEMBER',
            details: { fbUserId: fbUser.id, fbName: fbUser.name, fbEmail: fbUser.email },
            ipAddress,
            userAgent,
        });

        const successUrl = returnTo.includes('?')
            ? `${returnTo}&success=member_added`
            : `${returnTo}?success=member_added`;
        return NextResponse.redirect(new URL(successUrl, req.url));
    } catch (error) {
        console.error('Error in team callback:', error);
        // Fallback to settings page on error
        return NextResponse.redirect(
            new URL('/settings?section=team&error=callback_failed', req.url)
        );
    }
}
