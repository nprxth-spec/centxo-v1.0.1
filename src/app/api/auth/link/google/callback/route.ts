/**
 * Google Account Link – Step 2: Handle OAuth Callback
 * GET /api/auth/link/google/callback
 *
 * Exchanges the authorization code for tokens, fetches the Google
 * profile, and links (or updates) the Account record in the DB
 * for the user identified by the "state" parameter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';
import { GOOGLE_LINK_REDIRECT_URI } from '../route';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');   // user id
    const error = searchParams.get('error');

    const failRedirect = (reason: string) =>
        NextResponse.redirect(new URL(`/settings?tab=profile&linkError=${reason}`, req.url));

    if (error) return failRedirect(`google_denied`);
    if (!code || !state) return failRedirect('google_missing_params');

    try {
        // 1. Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_LINK_REDIRECT_URI,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error('[link/google/callback] Token exchange failed:', tokenData);
            return failRedirect('google_token');
        }

        // 2. Fetch Google profile
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const googleUser = await userInfoRes.json();

        if (!googleUser.id) {
            console.error('[link/google/callback] Failed to get Google user info:', googleUser);
            return failRedirect('google_profile');
        }

        // 3. Verify the target user exists (state = user id)
        const user = await prisma.user.findUnique({ where: { id: state } });
        if (!user) return failRedirect('user_not_found');

        // 4. Ensure this Google account isn't already linked to a *different* user
        const existingAccount = await prisma.account.findFirst({
            where: { provider: 'google', providerAccountId: googleUser.id },
        });

        if (existingAccount && existingAccount.userId !== user.id) {
            return failRedirect('google_already_linked_to_other');
        }

        // 5. Link (create or update) Account record
        if (!existingAccount) {
            await prisma.account.create({
                data: {
                    userId: user.id,
                    type: 'oauth',
                    provider: 'google',
                    providerAccountId: googleUser.id,
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token ?? null,
                    expires_at: tokenData.expires_in
                        ? Math.floor(Date.now() / 1000) + tokenData.expires_in
                        : null,
                    token_type: tokenData.token_type ?? null,
                    scope: tokenData.scope ?? null,
                    id_token: tokenData.id_token ?? null,
                },
            });
        } else {
            // Already linked to this user — refresh tokens
            await prisma.account.update({
                where: { id: existingAccount.id },
                data: {
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token ?? undefined,
                    expires_at: tokenData.expires_in
                        ? Math.floor(Date.now() / 1000) + tokenData.expires_in
                        : undefined,
                    id_token: tokenData.id_token ?? undefined,
                },
            });
        }

        // 6. Fill in name / image from Google if user currently has none
        if (!user.name && googleUser.name) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    name: googleUser.name,
                    image: googleUser.picture ?? undefined,
                },
            });
        }

        // 7. Audit log
        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
            userId: user.id,
            action: 'LINK_GOOGLE',
            details: { googleId: googleUser.id, googleEmail: googleUser.email },
            ipAddress,
            userAgent,
        });

        console.log(`✅ Linked Google account (${googleUser.email}) to user:`, user.email);
        return NextResponse.redirect(new URL('/settings?tab=profile&linkSuccess=google', req.url));

    } catch (err: any) {
        console.error('[link/google/callback] Error:', err);
        return failRedirect('google_error');
    }
}
