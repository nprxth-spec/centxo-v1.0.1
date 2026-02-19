/**
 * Meta Connection API Routes
 * GET /api/meta/connect - Initialize Facebook OAuth
 * GET /api/meta/callback - Handle OAuth callback
 * POST /api/meta/select-account - Select ad account and page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import MetaAPIClient, { encryptToken } from '@/lib/services/metaClient';

const prisma = new PrismaClient();

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI!;

// Initialize Facebook OAuth
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.error('[meta/connect] No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required environment variables
    if (!FACEBOOK_APP_ID) {
      console.error('[meta/connect] FACEBOOK_APP_ID is not configured');
      return NextResponse.json({ 
        error: 'FACEBOOK_APP_ID is not configured. Please check your environment variables.' 
      }, { status: 500 });
    }

    if (!FACEBOOK_APP_SECRET) {
      console.error('[meta/connect] FACEBOOK_APP_SECRET is not configured');
      return NextResponse.json({ 
        error: 'FACEBOOK_APP_SECRET is not configured. Please check your environment variables.' 
      }, { status: 500 });
    }

    if (!FACEBOOK_REDIRECT_URI) {
      console.error('[meta/connect] FACEBOOK_REDIRECT_URI is not configured');
      return NextResponse.json({ 
        error: 'FACEBOOK_REDIRECT_URI is not configured. Please check your environment variables.' 
      }, { status: 500 });
    }

    const scope = [
      'email',
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'pages_manage_ads',
      'pages_messaging',
      'ads_management',
      'ads_read',
      'business_management',
    ].join(',');

    // Allow callers to specify where to redirect after the OAuth callback
    // (e.g. ?returnTo=profile when linking from Profile Settings)
    const returnTo = new URL(request.url).searchParams.get('returnTo') || 'team';
    // Encode as "email|returnTo" so the callback can split on "|"
    const stateValue = `${session.user.email || ''}|${returnTo}`;

    const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(
      FACEBOOK_REDIRECT_URI
    )}&scope=${encodeURIComponent(scope)}&response_type=code&state=${encodeURIComponent(stateValue)}&auth_type=reauthorize`;

    console.log('[meta/connect] Generated auth URL for user:', session.user.email);
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[meta/connect] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to initialize Facebook connection. Please try again.' 
    }, { status: 500 });
  }
}
