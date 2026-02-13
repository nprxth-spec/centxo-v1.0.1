/**
 * POST /api/campaigns/[id]/toggle
 * Toggle campaign status (ACTIVE <-> PAUSED)
 * Automatically clears cache after update
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { invalidateUserCache } from '@/lib/cache/redis';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: campaignId } = await params;

    // Fetch user with team members to collect all available tokens
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        metaAccount: {
          select: { accessToken: true },
        },
        accounts: {
          where: { provider: 'facebook' },
          select: { access_token: true },
        },
      },
    });

    // Collect all available tokens
    const tokens: string[] = [];

    // 1. MetaAccount token (decrypt first)
    if (user?.metaAccount?.accessToken) {
      try {
        tokens.push(decryptToken(user.metaAccount.accessToken));
      } catch (e) {
        console.error('[toggle] Failed to decrypt MetaAccount token:', e);
      }
    }

    // 2. NextAuth Facebook account tokens
    if (user?.accounts) {
      user.accounts.forEach(acc => {
        if (acc.access_token) tokens.push(acc.access_token);
      });
    }

    // 3. Check if current user is a team member and fetch team owner's tokens
    const memberRecord = await prisma.teamMember.findFirst({
      where: { memberEmail: session.user.email },
    });

    let teamOwnerId = user?.id; // Default to current user

    if (memberRecord?.userId) {
      // Current user is a team member, use team owner's ID
      teamOwnerId = memberRecord.userId;
      console.log('[toggle] User is team member, fetching owner tokens from:', teamOwnerId);

      // Fetch team owner's data
      const teamOwner = await prisma.user.findUnique({
        where: { id: teamOwnerId },
        include: {
          metaAccount: {
            select: { accessToken: true },
          },
          accounts: {
            where: { provider: 'facebook' },
            select: { access_token: true },
          },
        },
      });

      // Add team owner's MetaAccount token
      if (teamOwner?.metaAccount?.accessToken) {
        try {
          const decrypted = decryptToken(teamOwner.metaAccount.accessToken);
          if (!tokens.includes(decrypted)) {
            tokens.push(decrypted);
          }
        } catch (e) {
          console.error('[toggle] Failed to decrypt team owner MetaAccount token:', e);
        }
      }

      // Add team owner's Facebook account tokens
      if (teamOwner?.accounts) {
        teamOwner.accounts.forEach(acc => {
          if (acc.access_token && !tokens.includes(acc.access_token)) {
            tokens.push(acc.access_token);
          }
        });
      }
    }

    // 4. Fetch team members tokens
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        userId: teamOwnerId,
        memberType: 'facebook',
        facebookUserId: { not: null },
        accessToken: { not: null },
      },
    });

    teamMembers.forEach(member => {
      if (member.accessToken && !tokens.includes(member.accessToken)) {
        tokens.push(member.accessToken);
      }
    });

    // 5. Session token (fallback)
    const sessionToken = (session as any).accessToken;
    if (sessionToken && !tokens.includes(sessionToken)) {
      tokens.push(sessionToken);
    }

    console.log('[toggle] Found tokens:', tokens.length);

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected' },
        { status: 400 }
      );
    }

    // Try each token until one works
    let accessToken: string | null = null;
    let lastError: any = null;

    for (const token of tokens) {
      try {
        const testResponse = await fetch(
          `https://graph.facebook.com/v22.0/${campaignId}?fields=id&access_token=${token}`
        );
        if (testResponse.ok) {
          accessToken = token;
          break;
        }
      } catch (e) {
        lastError = e;
        continue;
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No valid Facebook token found for this campaign' },
        { status: 400 }
      );
    }

    // Get current status
    const currentResponse = await fetch(
      `https://graph.facebook.com/v22.0/${campaignId}?fields=status&access_token=${accessToken}`
    );

    if (!currentResponse.ok) {
      const error = await currentResponse.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to get campaign status' },
        { status: currentResponse.status }
      );
    }

    const currentData = await currentResponse.json();
    const currentStatus = currentData.status;

    // Toggle status
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    // Update status in Meta
    const updateResponse = await fetch(
      `https://graph.facebook.com/v22.0/${campaignId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          access_token: accessToken,
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to update campaign status' },
        { status: updateResponse.status }
      );
    }

    // Clear ALL caches for this user to ensure fresh data
    await invalidateUserCache(session.user.id);

    console.log(`[Campaign Toggle] ${campaignId}: ${currentStatus} -> ${newStatus}, cache cleared`);

    return NextResponse.json({
      success: true,
      campaignId,
      oldStatus: currentStatus,
      newStatus: newStatus,
      message: `Campaign ${newStatus === 'ACTIVE' ? 'activated' : 'paused'} successfully`,
    });
  } catch (error) {
    console.error('Error toggling campaign status:', error);
    return NextResponse.json(
      { error: 'Failed to toggle campaign status' },
      { status: 500 }
    );
  }
}
