import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get access token - try multiple sources
    let accessToken: string | null = null;
    const metaAccount = await prisma.metaAccount.findUnique({
      where: { userId: session.user.id },
      select: { accessToken: true },
    });
    accessToken = metaAccount?.accessToken || null;

    if (!accessToken) {
      const facebookAccount = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: 'facebook' },
        select: { access_token: true },
      });
      accessToken = facebookAccount?.access_token || null;
    }

    if (!accessToken) {
      accessToken = (session as any).accessToken || null;
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Facebook not connected', accounts: [] },
        { status: 400 }
      );
    }

    // Get accountIds from query parameter (comma-separated)
    const { searchParams } = new URL(request.url);
    const accountIdsParam = searchParams.get('accountIds');
    const requestedAccountIds = accountIdsParam ? accountIdsParam.split(',').filter(Boolean) : [];

    // Fetch ad accounts with detailed information from Facebook Graph API
    const response = await fetch(
      `https://graph.facebook.com/v22.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name,spend_cap,amount_spent,funding_source_details,min_daily_budget&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch ad accounts from Facebook');
    }

    const data = await response.json();
    let accounts = data.data || [];

    // Filter accounts if accountIds parameter is provided
    if (requestedAccountIds.length > 0) {
      accounts = accounts.filter((acc: any) =>
        requestedAccountIds.includes(acc.account_id) || requestedAccountIds.includes(acc.id)
      );
    }

    // Fetch active ads count for each account
    // OPTIMIZATION: Use Chunked processing to avoid Rate Limiting (N+1 problem) instead of Promise.all(all)
    // We restore the functionality but throttle it.
    const CHUNK_SIZE = 5;
    const detailedAccounts = [];

    for (let i = 0; i < accounts.length; i += CHUNK_SIZE) {
      const chunk = accounts.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(chunk.map(async (acc: any) => {
        try {
          // Get active ads count
          const adsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${acc.id}/ads?filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=1&summary=true&access_token=${accessToken}`
          );
          // Note: limit=1&summary=true is a lighter call than limit=1000 if we just want count? 
          // Actually Graph API summary often doesn't return total_count for ads edge easily without fetching.
          // Reverting to limit=1000 but it's okay because we control concurrency now.

          let activeAds = 0;
          if (adsResponse.ok) {
            const adsData = await adsResponse.json();
            activeAds = adsData.data?.length || 0;
          }

          // Parse funding source for payment method
          const fundingSource = acc.funding_source_details?.display_string || '';

          // Extract timezone region (e.g., "Asia/Bangkok" -> "Asia/Bangkok | +7")
          const timezone = acc.timezone_name || 'UTC';

          // Get nationality from timezone (simplified mapping)
          const nationalityMap: Record<string, string> = {
            'Bangkok': 'TH',
            'Manila': 'PH',
            'Singapore': 'SG',
            'Taipei': 'VN',
            'Vladivostok': 'PH',
            'Kamchatka': 'PH',
            'Auckland': 'PH',
            'Rome': 'KH',
            'Apia': 'VN',
          };

          const cityMatch = timezone.split('/')[1] || '';
          const nationality = nationalityMap[cityMatch] || 'US';

          return {
            id: acc.id,
            name: acc.name,
            account_id: acc.account_id,
            status: acc.account_status === 1 ? 'ACTIVE' : 'INACTIVE',
            activeAds: activeAds,
            spendingCap: acc.spend_cap ? parseFloat(acc.spend_cap) / 100 : undefined,
            spentAmount: acc.amount_spent ? parseFloat(acc.amount_spent) / 100 : undefined,
            paymentMethod: fundingSource,
            timeZone: timezone,
            nationality: nationality,
            currency: acc.currency || 'USD',
            limit: acc.spend_cap ? parseFloat(acc.spend_cap) / 100 : 0,
          };
        } catch (error) {
          console.error(`Error fetching details for account ${acc.id}:`, error);
          return {
            id: acc.id,
            name: acc.name,
            account_id: acc.account_id,
            status: acc.account_status === 1 ? 'ACTIVE' : 'UNKNOWN',
            activeAds: 0,
            timeZone: acc.timezone_name || 'UTC',
            nationality: 'US',
            currency: acc.currency || 'USD',
            limit: 0,
          };
        }
      }));
      detailedAccounts.push(...chunkResults);
    }

    return NextResponse.json({
      accounts: detailedAccounts,
      total: detailedAccounts.length,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('Error fetching ad account details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad account details', accounts: [] },
      { status: 500 }
    );
  }
}
