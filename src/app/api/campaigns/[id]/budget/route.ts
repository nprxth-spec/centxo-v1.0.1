/**
 * PATCH /api/campaigns/[id]/budget
 * Update campaign budget (daily or lifetime)
 * Meta API uses basic units (cents) - we accept main units and convert
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { invalidateUserCache } from '@/lib/cache/redis';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';
import { toBasicUnits } from '@/lib/currency-utils';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const { dailyBudget, lifetimeBudget, adAccountId, currency = 'USD' } = body;

    if (!adAccountId) {
      return NextResponse.json({ error: 'adAccountId is required' }, { status: 400 });
    }

    const hasDaily = typeof dailyBudget === 'number' && dailyBudget > 0;
    const hasLifetime = typeof lifetimeBudget === 'number' && lifetimeBudget > 0;

    if (!hasDaily && !hasLifetime) {
      return NextResponse.json({ error: 'dailyBudget or lifetimeBudget (positive number) is required' }, { status: 400 });
    }
    if (hasDaily && hasLifetime) {
      return NextResponse.json({ error: 'Provide either dailyBudget OR lifetimeBudget, not both' }, { status: 400 });
    }

    // Collect tokens (same pattern as toggle)
    const tokens: TokenInfo[] = [];
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        metaAccount: { select: { accessToken: true } },
        accounts: { where: { provider: 'facebook' }, select: { access_token: true } },
      },
    });

    if (user?.metaAccount?.accessToken) {
      try {
        tokens.push({ token: decryptToken(user.metaAccount.accessToken), name: 'Meta' });
      } catch (e) {
        console.error('[campaign-budget] Failed to decrypt token:', e);
      }
    }
    if (user?.accounts) {
      user.accounts.forEach((acc: { access_token: string | null }) => {
        if (acc.access_token) tokens.push({ token: acc.access_token, name: 'Account' });
      });
    }

    const memberRecord = await prisma.teamMember.findFirst({
      where: { memberEmail: session.user.email },
    });
    let teamOwnerId = user?.id;
    if (memberRecord?.userId) {
      teamOwnerId = memberRecord.userId;
      const teamOwner = await prisma.user.findUnique({
        where: { id: teamOwnerId },
        include: {
          metaAccount: { select: { accessToken: true } },
          accounts: { where: { provider: 'facebook' }, select: { access_token: true } },
        },
      });
      if (teamOwner?.metaAccount?.accessToken) {
        try {
          tokens.push({ token: decryptToken(teamOwner.metaAccount.accessToken), name: 'Owner' });
        } catch (e) {
          console.error('[campaign-budget] Owner token decrypt failed:', e);
        }
      }
      if (teamOwner?.accounts) {
        teamOwner.accounts.forEach((acc: { access_token: string | null }) => {
          if (acc.access_token) tokens.push({ token: acc.access_token, name: 'OwnerAccount' });
        });
      }
    }

    const teamMembers = await prisma.teamMember.findMany({
      where: { userId: teamOwnerId, memberType: 'facebook', facebookUserId: { not: null }, accessToken: { not: null } },
    });
    teamMembers.forEach((m: { accessToken: string | null }) => {
      if (m.accessToken && !tokens.some(t => t.token === m.accessToken)) {
        tokens.push({ token: m.accessToken, name: 'Member' });
      }
    });

    const sessionToken = (session as any).accessToken;
    if (sessionToken && !tokens.some(t => t.token === sessionToken)) {
      tokens.push({ token: sessionToken, name: 'Session' });
    }

    const accessToken = await getValidTokenForAdAccount(adAccountId, tokens);
    if (!accessToken) {
      return NextResponse.json({ error: 'No valid token for this ad account' }, { status: 400 });
    }

    const updateBody: Record<string, string | number> = {
      access_token: accessToken,
    };
    if (hasDaily) {
      updateBody.daily_budget = toBasicUnits(dailyBudget, currency);
      updateBody.lifetime_budget = 0; // Clear lifetime when setting daily
    } else {
      updateBody.lifetime_budget = toBasicUnits(lifetimeBudget, currency);
      updateBody.daily_budget = 0; // Clear daily when setting lifetime
    }

    const res = await fetch(`https://graph.facebook.com/v22.0/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: err.error?.message || 'Failed to update campaign budget' },
        { status: res.status }
      );
    }

    await invalidateUserCache(session.user.id);

    return NextResponse.json({
      success: true,
      campaignId,
      dailyBudget: hasDaily ? dailyBudget : undefined,
      lifetimeBudget: hasLifetime ? lifetimeBudget : undefined,
    });
  } catch (error) {
    console.error('[campaign-budget] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign budget' },
      { status: 500 }
    );
  }
}
