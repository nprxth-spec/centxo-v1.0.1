import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        // Cast to any to access custom sessionId property
        const sessionId = (session as any)?.sessionId;

        if (!sessionId) {
            return NextResponse.json({ error: 'No active session' }, { status: 401 });
        }

        const headersList = await headers();
        const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';
        const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'Unknown IP';

        // Update the session by ID (since we manually created it with UUID)
        await prisma.session.update({
            where: { id: sessionId },
            data: {
                userAgent,
                ipAddress: ip.split(',')[0],
                lastActive: new Date(),
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        // console.error('Error in session heartbeat:', error); 
        // Suppress generic errors to avoid log spam if session is invalid/expired
        return NextResponse.json({ error: 'Failed heartbeat' }, { status: 500 });
    }
}
