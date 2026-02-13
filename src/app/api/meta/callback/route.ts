/**
 * Meta OAuth Callback Handler
 * GET /api/meta/callback?code=xxx&state=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { encryptToken } from '@/lib/services/metaClient';
import { exchangeForLongLivedToken } from '@/lib/facebook/token-helper';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';
import { deleteCache, generateCacheKey } from '@/lib/cache/redis';
import { invalidateTeamCachesForUser } from '@/lib/cache/invalidate-team';

const prisma = new PrismaClient();

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // email from state
    const error = searchParams.get('error');
    const errorReason = searchParams.get('error_reason');
    const errorDescription = searchParams.get('error_description');

    // Check for OAuth errors from Facebook
    if (error) {
      console.error('[meta/callback] OAuth error from Facebook:', { error, errorReason, errorDescription });
      return NextResponse.redirect(
        new URL(`/settings?tab=team&metaError=oauth_error&error_reason=${encodeURIComponent(errorReason || error)}`, request.url)
      );
    }

    if (!code || !state) {
      console.error('[meta/callback] Missing code or state:', { code: !!code, state: !!state });
      return NextResponse.redirect(
        new URL('/settings?tab=team&metaError=missing_code', request.url)
      );
    }

    // Validate required environment variables
    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET || !FACEBOOK_REDIRECT_URI) {
      console.error('[meta/callback] Missing environment variables:', {
        hasAppId: !!FACEBOOK_APP_ID,
        hasAppSecret: !!FACEBOOK_APP_SECRET,
        hasRedirectUri: !!FACEBOOK_REDIRECT_URI,
      });
      return NextResponse.redirect(
        new URL('/settings?tab=team&metaError=config_error', request.url)
      );
    }

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&redirect_uri=${encodeURIComponent(
      FACEBOOK_REDIRECT_URI
    )}&code=${code}`;

    console.log('[meta/callback] Exchanging code for access token...');
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('[meta/callback] Failed to get access token:', tokenData);
      throw new Error(`Failed to get access token: ${tokenData.error?.message || 'Unknown error'}`);
    }

    // Exchange short-lived token for long-lived (~60 days)
    const { accessToken, expiresIn } = await exchangeForLongLivedToken(tokenData.access_token);

    // Get user info (include email so we can show Facebook email in Team > Facebook Accounts)
    const userInfoUrl = `https://graph.facebook.com/v22.0/me?access_token=${accessToken}&fields=id,name,email`;
    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = await userInfoResponse.json();

    if (!userInfo.id) {
      throw new Error('Failed to get user info');
    }

    // Find user by email (from state)
    const user = await prisma.user.findUnique({
      where: { email: state },
    });

    if (!user) {
      return NextResponse.redirect(
        new URL('/settings?tab=team&metaError=user_not_found', request.url)
      );
    }

    // Encrypt token
    const encryptedToken = encryptToken(accessToken);

    // Save or update Meta account
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.metaAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        metaUserId: userInfo.id,
        accessToken: encryptedToken,
        accessTokenExpires: expiresAt,
      },
      update: {
        metaUserId: userInfo.id,
        accessToken: encryptedToken,
        accessTokenExpires: expiresAt,
      },
    });

    // Also upsert TeamMember so the Facebook name and email are cached for Team > Facebook Accounts
    await prisma.teamMember.upsert({
      where: { facebookUserId: userInfo.id },
      update: {
        userId: user.id,
        facebookName: userInfo.name,
        facebookEmail: userInfo.email ?? null,
        accessToken: accessToken,
        accessTokenExpires: expiresAt,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        memberType: 'facebook',
        facebookUserId: userInfo.id,
        facebookName: userInfo.name,
        facebookEmail: userInfo.email ?? null,
        accessToken: accessToken,
        accessTokenExpires: expiresAt,
        role: 'OWNER', // When connecting manually, they are the owner/host
      },
    });

    // Invalidate team caches so next fetch gets fresh data (Redis + in-memory)
    invalidateTeamCachesForUser(user.id);
    await Promise.all([
      deleteCache(generateCacheKey('team:config', user.id)),
      deleteCache(generateCacheKey('team:ad-accounts', user.id)),
      deleteCache(generateCacheKey('team:facebook-pictures', user.id)),
    ]);

    const { ipAddress, userAgent } = getRequestMetadata(request);
    await createAuditLog({
      userId: user.id,
      action: 'META_CONNECT',
      details: { metaUserId: userInfo.id, metaName: userInfo.name, email: user.email },
      ipAddress,
      userAgent,
    });

    // Redirect to Account Settings > Team & Connection tab
    return NextResponse.redirect(
      new URL('/settings?tab=team&metaSuccess=true', request.url)
    );
  } catch (error: any) {
    console.error('[meta/callback] Error:', error);
    const errorMessage = error?.message || 'Unknown error occurred';
    console.error('[meta/callback] Error details:', {
      message: errorMessage,
      stack: error?.stack,
    });
    return NextResponse.redirect(
      new URL(`/settings?tab=team&metaError=callback_failed&error_msg=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
