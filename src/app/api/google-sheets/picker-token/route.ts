import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refreshAccessToken } from '@/lib/google-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                accounts: { where: { provider: 'google' } },
            },
        });

        const googleAccount = user?.accounts[0];
        if (!googleAccount?.refresh_token) {
            return NextResponse.json(
                { error: 'Google Account not connected. Please sign in with Google.' },
                { status: 400 }
            );
        }

        const tokens = await refreshAccessToken(googleAccount.refresh_token);
        if (!tokens.access_token) {
            return NextResponse.json(
                { error: 'Failed to get Google access token. Please sign in again.' },
                { status: 500 }
            );
        }

        const appId = process.env.GOOGLE_CLIENT_ID?.split('-')[0];

        return NextResponse.json({
            accessToken: tokens.access_token,
            apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || undefined,
            appId,
        });
    } catch (error) {
        console.error('Picker token error:', error);
        return NextResponse.json(
            { error: 'Failed to get token for Google Picker' },
            { status: 500 }
        );
    }
}
