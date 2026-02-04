import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all configured meta accounts for this user
    const metaAccounts = await prisma.metaAccount.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        adAccountId: true,
        adAccountName: true,
        pageId: true,
        pageName: true,
        accessToken: true,
      },
    });

    // Separate ad accounts and pages
    const adAccounts = metaAccounts
      .filter((acc: any) => acc.adAccountId)
      .map((acc: any) => ({
        id: acc.id,
        account_id: acc.adAccountId!,
        name: acc.adAccountName || 'Unknown',
      }));

    const pages = metaAccounts
      .filter((acc: any) => acc.pageId)
      .map((acc: any) => ({
        id: acc.pageId!,
        name: acc.pageName || 'Unknown',
      }));

    return NextResponse.json({
      adAccounts,
      pages,
    });
  } catch (error) {
    console.error('Error fetching meta accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
