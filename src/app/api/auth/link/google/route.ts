/**
 * Google Account Link – Step 1: Redirect to Google OAuth
 * GET /api/auth/link/google
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GOOGLE_LINK_REDIRECT_URI } from './config';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    if (!GOOGLE_CLIENT_ID) {
        return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not configured' }, { status: 500 });
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GOOGLE_LINK_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', session.user.id);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    return NextResponse.redirect(authUrl.toString());
}
