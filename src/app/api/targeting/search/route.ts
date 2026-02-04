
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query || query.length < 2) {
            return NextResponse.json({ interests: [] });
        }

        const interests = await prisma.facebookInterest.findMany({
            where: {
                name: {
                    contains: query, // Case insensitive search usually depends on DB collation
                },
            },
            take: 20,
            orderBy: {
                audienceSizeUpperBound: 'desc',
            },
            select: {
                id: true,
                fbId: true,
                name: true,
                audienceSizeLowerBound: true,
                audienceSizeUpperBound: true,
                topic: true
            }
        });

        // Map to simplified format if needed, or return as is
        const formatted = interests.map((i: any) => ({
            id: i.fbId, // Return FB ID as the main ID for targeting
            name: i.name,
            audience: i.audienceSizeUpperBound ? `~${Number(i.audienceSizeUpperBound).toLocaleString()}` : 'N/A',
            topic: i.topic
        }));

        return NextResponse.json({ interests: formatted });

    } catch (error: any) {
        console.error('Error searching interests:', error);
        return NextResponse.json(
            { error: 'Failed to search interests' },
            { status: 500 }
        );
    }
}
