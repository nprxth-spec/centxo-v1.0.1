import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with all details
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: true,
        metaAccount: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get all users with same email (should only be one)
    const allUsersWithEmail = await prisma.user.findMany({
      where: { email: session.user.email },
      include: {
        accounts: true,
      },
    });

    return NextResponse.json({
      currentSession: {
        email: session.user.email,
        name: session.user.name,
        id: session.user.id,
      },
      userData: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        accounts: user.accounts.map((acc: any) => ({
          id: acc.id,
          provider: acc.provider,
          providerAccountId: acc.providerAccountId,
          type: acc.type,
          userId: acc.userId,
        })),
        metaAccount: user.metaAccount ? {
          id: user.metaAccount.id,
          metaUserId: user.metaAccount.metaUserId,
          adAccountId: user.metaAccount.adAccountId,
          pageId: user.metaAccount.pageId,
        } : null,
      },
      allUsersWithSameEmail: allUsersWithEmail.map((u: any) => ({
        id: u.id,
        email: u.email,
        accounts: u.accounts.map((acc: any) => ({
          provider: acc.provider,
          userId: acc.userId,
        })),
      })),
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
