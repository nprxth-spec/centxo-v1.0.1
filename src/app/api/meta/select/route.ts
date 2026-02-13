/**
 * Meta Account Selection API
 * GET /api/meta/accounts - Get available ad accounts
 * GET /api/meta/pages - Get available pages
 * POST /api/meta/select - Save selected ad account and page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import MetaAPIClient from '@/lib/services/metaClient';
import { getEffectiveUserIds } from '@/lib/team-utils';

const prisma = new PrismaClient();

// Get available ad accounts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'accounts' or 'pages'

    // Get effective user IDs (includes team host IDs if user is a team member)
    const effectiveUserIds = await getEffectiveUserIds(session);

    if (effectiveUserIds.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all MetaAccounts from effective user IDs
    const metaAccounts = await prisma.metaAccount.findMany({
      where: {
        userId: {
          in: effectiveUserIds,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (metaAccounts.length === 0) {
      return NextResponse.json(
        { error: 'Meta account not connected' },
        { status: 400 }
      );
    }

    // Use the first meta account (or merge results from all accounts)
    const metaAccount = metaAccounts[0];
    const metaClient = new MetaAPIClient(metaAccount.accessToken);

    if (type === 'accounts') {
      const accounts = await metaClient.getAdAccounts(metaAccount.metaUserId);
      return NextResponse.json({ 
        accounts: accounts.data || [],
        source: metaAccount.user.email || metaAccount.user.name,
      });
    } else if (type === 'pages') {
      const pages = await metaClient.getPages(metaAccount.metaUserId);
      return NextResponse.json({ 
        pages: pages.data || [],
        source: metaAccount.user.email || metaAccount.user.name,
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching Meta data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Meta' },
      { status: 500 }
    );
  }
}

// Save selected ad account and page
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { adAccountId, adAccountName, pageId, pageName, pageAccessToken } = body;

    if (!adAccountId || !pageId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get effective user IDs
    const effectiveUserIds = await getEffectiveUserIds(session);

    if (effectiveUserIds.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find meta account from effective user IDs
    const metaAccount = await prisma.metaAccount.findFirst({
      where: {
        userId: {
          in: effectiveUserIds,
        },
      },
    });

    if (!metaAccount) {
      return NextResponse.json(
        { error: 'Meta account not connected' },
        { status: 400 }
      );
    }

    // Update Meta account with selected data
    await prisma.metaAccount.update({
      where: { id: metaAccount.id },
      data: {
        adAccountId,
        adAccountName,
        pageId,
        pageName,
        pageAccessToken,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Meta selection:', error);
    return NextResponse.json(
      { error: 'Failed to save selection' },
      { status: 500 }
    );
  }
}
