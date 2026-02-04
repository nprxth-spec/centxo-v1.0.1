import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { withCache, generateCacheKey, CacheTTL } from '@/lib/cache/redis';

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  disable_reason?: string;
  currency: string;
  spend_cap: number | null;
  amount_spent: number;
  business_name?: string;
  business_country_code?: string;
  timezone_name?: string;
  timezone_offset?: number;
  funding_source: string | null;
  owner: string;
}

interface AdAccountsResponse {
  accounts: AdAccount[];
  total: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Rate limiting (User ID priority)
    const rateLimitResponse = await rateLimit(request, RateLimitPresets.standard, session?.user?.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for cache bypass
    const bypassCache = request.nextUrl.searchParams.get('refresh') === 'true';
    const cacheKey = generateCacheKey('meta:ad-accounts', session.user.id);

    // Fetch function (will be called if cache miss or stale)
    const fetchAdAccounts = async (): Promise<AdAccountsResponse> => {
      const { prisma } = await import('@/lib/prisma');
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          teamMembers: true,
          metaAccount: {
            select: { accessToken: true },
          },
        },
      });

      console.log('[ad-accounts] User ID:', session.user.id);
      console.log('[ad-accounts] Team members count:', (user as any)?.teamMembers?.length || 0);

      if (!user) {
        throw new Error('User not found');
      }

      // Collect all tokens: MetaAccount + Main User + Team Members
      const tokens: { token: string; name: string; isTeamMember?: boolean }[] = [];

      // 1. MetaAccount Token (most reliable)
      if ((user as any).metaAccount?.accessToken) {
        tokens.push({
          token: (user as any).metaAccount.accessToken,
          name: user.name || 'Main Account',
          isTeamMember: false
        });
      }

      // 2. Main User Token (fallback)
      const mainAccessToken = (session as any).accessToken;
      if (mainAccessToken && !tokens.some(t => t.token === mainAccessToken)) {
        tokens.push({
          token: mainAccessToken,
          name: user.name || 'Session Account',
          isTeamMember: false
        });
      }

      // 3. Team Members Tokens
      if ((user as any).teamMembers && (user as any).teamMembers.length > 0) {
        console.log('[ad-accounts] Processing team members:', (user as any).teamMembers.length);
        (user as any).teamMembers.forEach((member: any) => {
          console.log('[ad-accounts] Team member:', member.id, 'hasToken:', !!member.accessToken, 'type:', member.memberType);
          if (member.accessToken && !tokens.some(t => t.token === member.accessToken)) {
            tokens.push({
              token: member.accessToken,
              name: member.facebookName || 'Team Member',
              isTeamMember: true
            });
          }
        });
      }

      console.log('[ad-accounts] Total tokens collected:', tokens.length);

      if (tokens.length === 0) {
        return { accounts: [], total: 0 };
      }

      const allAccounts: any[] = [];

      // Fetch accounts for all tokens in parallel
      await Promise.all(tokens.map(async (tokenData) => {
        try {
          const response = await fetch(
            `https://graph.facebook.com/v22.0/me/adaccounts?fields=id,name,account_id,account_status,disable_reason,currency,spend_cap,amount_spent,business_name,business_country_code,timezone_name,timezone_offset_hours_utc,funding_source_details&limit=500&access_token=${tokenData.token}`
          );

          if (!response.ok) {
            console.warn(`Failed to fetch ad accounts for ${tokenData.name}: ${response.status}`);
            return;
          }

          const data = await response.json();
          const accounts = data.data || [];

          // Map and add source info if needed
          const accountsWithSource = accounts.map((acc: any) => ({
            ...acc,
            owner_name: tokenData.name
          }));
          allAccounts.push(...accountsWithSource);

        } catch (err) {
          console.error(`Error fetching for ${tokenData.name}:`, err);
        }
      }));

      // Remove duplicates by account_id
      const uniqueAccounts = Array.from(new Map(allAccounts.map(item => [item.account_id, item])).values());

      return {
        accounts: uniqueAccounts.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          account_id: acc.account_id,
          account_status: acc.account_status,
          disable_reason: acc.disable_reason,
          currency: acc.currency,
          spend_cap: acc.spend_cap ? parseFloat(acc.spend_cap) / 100 : null,
          amount_spent: acc.amount_spent ? parseFloat(acc.amount_spent) / 100 : 0,
          business_name: acc.business_name,
          business_country_code: acc.business_country_code,
          timezone_name: acc.timezone_name,
          timezone_offset: acc.timezone_offset_hours_utc,
          funding_source: acc.funding_source_details?.display_string || null,
          owner: acc.owner_name,
        })),
        total: uniqueAccounts.length,
      };
    };

    // Use cache (30 minutes TTL); bypass with ?refresh=true
    let result: AdAccountsResponse;

    if (bypassCache) {
      console.log('[ad-accounts] Cache bypass requested');
      result = await fetchAdAccounts();
    } else {
      result = await withCache<AdAccountsResponse>(
        cacheKey,
        CacheTTL.AD_ACCOUNTS,
        fetchAdAccounts
      );
    }

    // Handle empty result (no tokens)
    if (result.total === 0 && result.accounts.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected', accounts: [] },
        { status: 400 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching ad accounts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage, accounts: [] },
      { status: 500 }
    );
  }
}
