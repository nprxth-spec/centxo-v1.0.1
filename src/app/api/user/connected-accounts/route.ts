import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get user with their connected accounts
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                accounts: {
                    select: {
                        provider: true,
                        providerAccountId: true,
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Format accounts data with provider-specific information
        const accountsPromises = user.accounts.map(async (account) => {
            let displayName = user.email || '';

            // For Facebook, try to get the Facebook name
            if (account.provider === 'facebook') {
                try {
                    // Get the account with access token
                    const fbAccount = await prisma.account.findFirst({
                        where: {
                            userId: user.id,
                            provider: 'facebook',
                        },
                        select: {
                            access_token: true,
                        },
                    });

                    if (fbAccount?.access_token) {
                        // Fetch Facebook profile
                        const response = await fetch(
                            `https://graph.facebook.com/me?fields=name&access_token=${fbAccount.access_token}`
                        );

                        if (response.ok) {
                            const fbProfile = await response.json();
                            displayName = fbProfile.name || user.name || user.email || '';
                        }
                    } else {
                        // Fallback to user's name
                        displayName = user.name || user.email || '';
                    }
                } catch (error) {
                    console.error('Error fetching Facebook name:', error);
                    displayName = user.name || user.email || '';
                }
            }

            return {
                provider: account.provider,
                email: displayName,
                connectedAt: new Date().toISOString(),
            };
        });

        const accounts = await Promise.all(accountsPromises);

        return NextResponse.json({
            accounts,
        });
    } catch (error) {
        console.error('Error fetching connected accounts:', error);
        return NextResponse.json(
            { error: 'Failed to fetch connected accounts' },
            { status: 500 }
        );
    }
}
