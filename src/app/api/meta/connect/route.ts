/**
 * Meta Connection API Routes
 * GET /api/meta/connect - Initialize Facebook OAuth
 * GET /api/meta/callback - Handle OAuth callback
 * POST /api/meta/select-account - Select ad account and page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import MetaAPIClient, { encryptToken } from '@/lib/services/metaClient';

const prisma = new PrismaClient();

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI!;

// Initialize Facebook OAuth
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scope = [
    'email',
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_manage_ads',
    'pages_manage_engagement',
    'pages_messaging',
    'pages_read_user_content',
    'ads_management',
    'ads_read',
    'read_insights',
    'business_management',
  ].join(',');

  const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(
    FACEBOOK_REDIRECT_URI
  )}&scope=${encodeURIComponent(scope)}&response_type=code&state=${session.user.email}&auth_type=rerequest`;

  return NextResponse.json({ authUrl });
}
