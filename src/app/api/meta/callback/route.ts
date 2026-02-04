/**
 * Meta OAuth Callback Handler
 * GET /api/meta/callback?code=xxx&state=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { encryptToken } from '@/lib/services/metaClient';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';

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

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 5184000; // 60 days default

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
