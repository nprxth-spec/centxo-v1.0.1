
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// Safety patch for BigInt
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if model exists (Prisma client validation)
        if (!prisma.facebookInterest) {
            console.error("Prisma model 'facebookInterest' is missing. Run 'npx prisma generate'.");
            return NextResponse.json({ error: 'Database configuration error: Model missing' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const topic = searchParams.get('topic');
        const lang = searchParams.get('lang') || 'en'; // Default to English

        // Helper function to get the right name field based on language
        const getNameField = (interest: any) => {
            if (lang === 'th') {
                return interest.nameTH || interest.name;
            }
            return interest.nameEN || interest.name;
        };

        if (topic) {
            const interests = await (prisma as any).facebookInterest.findMany({
                where: { topic },
                orderBy: { audienceSizeUpperBound: 'desc' },
                take: 100 // Limit to top 100 per topic
            });

            return NextResponse.json({
                interests: interests.map((i: any) => ({
                    ...i,
                    name: getNameField(i),
                    audienceSizeLowerBound: i.audienceSizeLowerBound?.toString(),
                    audienceSizeUpperBound: i.audienceSizeUpperBound?.toString(),
                }))
            });
        }

        // Fetch Top 20 Interests by Audience Size
        const topInterests = await (prisma as any).facebookInterest.findMany({
            orderBy: {
                audienceSizeUpperBound: 'desc',
            },
            take: 20,
        });

        // Group by Topic count
        const interestsByTopic = await (prisma as any).facebookInterest.groupBy({
            by: ['topic'],
            _count: {
                id: true,
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            }
        });

        return NextResponse.json({
            top20: topInterests.map((i: any) => ({
                ...i,
                name: getNameField(i),
                audienceSizeLowerBound: i.audienceSizeLowerBound?.toString(),
                audienceSizeUpperBound: i.audienceSizeUpperBound?.toString(),
            })),
            topics: interestsByTopic.map((t: any) => ({
                name: t.topic || 'Uncategorized',
                count: t._count.id
            }))
        });

    } catch (error: any) {
        console.error('Error fetching targeting data:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message
        }, { status: 500 });
    }
}
