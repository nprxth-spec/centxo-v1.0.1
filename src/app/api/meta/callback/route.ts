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

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/settings?section=connections&error=missing_code', request.url)
      );
    }

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&redirect_uri=${encodeURIComponent(
      FACEBOOK_REDIRECT_URI
    )}&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Exchange short-lived token for long-lived (~60 days)
    const { accessToken, expiresIn } = await exchangeForLongLivedToken(tokenData.access_token);

    // Get user info
    const userInfoUrl = `https://graph.facebook.com/v22.0/me?access_token=${accessToken}&fields=id,name`;
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
        new URL('/settings?section=connections&error=user_not_found', request.url)
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

    // Redirect to settings page
    return NextResponse.redirect(
      new URL('/settings?section=connections&success=true', request.url)
    );
  } catch (error) {
    console.error('Meta callback error:', error);
    return NextResponse.redirect(
      new URL('/settings?section=connections&error=callback_failed', request.url)
    );
  }
}
