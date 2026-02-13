import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user with team members and MetaAccount from database
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Meta Account Integrity Compliance: Use ONLY user's own tokens
    const { getUserTokensOnly } = await import('@/lib/facebook/user-tokens-only');
    const userTokens = await getUserTokensOnly(session);
    const tokens: { token: string; name: string }[] = userTokens.map(t => ({
      token: t.token,
      name: t.name,
    }));

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Facebook not connected', pages: [] },
        { status: 400 }
      );
    }

    const allPages: any[] = [];

    // Fetch pages for all tokens
    await Promise.all(tokens.map(async (tokenData) => {
      try {
        let nextUrl: string | null = `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,username,access_token,category,picture,tasks,is_published,fan_count,verification_status,page_token&limit=200&access_token=${tokenData.token}`;

        let tokenPages: any[] = [];
        let pageCount = 0;

        while (nextUrl && pageCount < 5) { // Safety limit
          pageCount++;
          const response: Response = await fetch(nextUrl);

          if (!response.ok) break;

          const data: any = await response.json();
          const pagesBatch = data.data || [];
          tokenPages = tokenPages.concat(pagesBatch);
          nextUrl = data.paging?.next || null;
        }

        // Add to main list with owner info
        const pagesWithSource = tokenPages.map((p: any) => ({
          ...p,
          owner_name: tokenData.name
        }));
        allPages.push(...pagesWithSource);

      } catch (err) {
        console.error(`Error fetching pages for ${tokenData.name}:`, err);
      }
    }));

    // Deduplicate by Page ID
    // If duplicates exist, we keep the first one encountered.
    // Ideally, we might want to prioritize "Main Account" (which is first in tokens list).
    const uniquePages = Array.from(new Map(allPages.map(item => [item.id, item])).values());

    // Filter by subscription selections
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['active', 'trial'] },
        expiresAt: { gte: new Date() }
      },
      select: { selectedPageIds: true }
    });

    // Collect all selected page IDs from active subscriptions
    const allSelectedPageIds = new Set<string>();
    subscriptions.forEach((sub: any) => {
      if (sub.selectedPageIds) {
        try {
          const ids = JSON.parse(sub.selectedPageIds);
          if (Array.isArray(ids)) {
            ids.forEach((id: string) => allSelectedPageIds.add(id));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Filter pages: if no selection, show all (backward compatible)
    const filteredPages = allSelectedPageIds.size > 0
      ? uniquePages.filter(page => allSelectedPageIds.has(page.id))
      : uniquePages;

    const getPageStatus = (page: any) => {
      if (page.is_published === false) return 'UNPUBLISHED';
      const canAdvertise = page.tasks?.includes('ADVERTISE');
      if (!canAdvertise) return 'RESTRICTED';
      return 'ACTIVE';
    };

    return NextResponse.json({
      pages: filteredPages.map((page: any) => ({
        id: page.id,
        name: page.name,
        username: page.username || null,
        access_token: page.access_token,
        category: page.category,
        picture: page.picture?.data?.url,
        status: getPageStatus(page),
        is_published: page.is_published,
        can_advertise: page.tasks?.includes('ADVERTISE') || false,
        owner: page.owner_name,
      })),
      total: filteredPages.length,
    });
  } catch (error) {
    console.error('Error fetching Facebook pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pages', pages: [] },
      { status: 500 }
    );
  }
}
