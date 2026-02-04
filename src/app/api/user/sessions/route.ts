import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current session ID from JWT session
        const currentSessionId = (session as any)?.sessionId;

        // Fetch all sessions for this user
        const rawSessions = await prisma.session.findMany({
            where: { userId: session.user.id },
            orderBy: { lastActive: 'desc' },
            select: {
                id: true,
                userAgent: true,
                ipAddress: true,
                lastActive: true,
                createdAt: true,
                expires: true,
            }
        });

        const sessions = rawSessions.map((s: any) => ({
            id: s.id,
            userAgent: s.userAgent,
            ipAddress: s.ipAddress,
            lastActive: s.lastActive,
            createdAt: s.createdAt,
            expires: s.expires,
            isCurrent: s.id === currentSessionId,
            // Parse User Agent for better display
            device: parseUserAgent(s.userAgent),
            location: s.ipAddress, // In a real app, use GeoIP lookup here
        }));

        return NextResponse.json({ sessions });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }
}

function parseUserAgent(ua: string | null) {
    if (!ua) return 'Unknown Device';
    // Simple parser
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Macintosh')) return 'Mac';
    if (ua.includes('Linux')) return 'Linux PC';
    if (ua.includes('Android')) return 'Android Device';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS Device';
    return 'Unknown Device';
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('id');

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        // Verify the session belongs to the user
        const targetSession = await prisma.session.findUnique({
            where: { id: sessionId }
        });

        if (!targetSession || targetSession.userId !== session.user.id) {
            return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
        }

        await prisma.session.delete({
            where: { id: sessionId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting session:', error);
        return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }
}
