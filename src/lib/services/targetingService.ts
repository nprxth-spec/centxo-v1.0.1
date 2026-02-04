
import { prisma } from '@/lib/prisma';

interface Interest {
    id: string;
    name: string;
}

export interface TargetingOptions {
    minAge?: number;
    maxAge?: number;
    genders?: number[]; // 1=F, 2=M
    interests: { id: string; name: string }[];
}

export async function generateSmartTargeting(productContext: string): Promise<TargetingOptions> {
    // Normalize context
    const context = (productContext || '').toLowerCase();

    // Extract potential keywords
    const keywords = context.split(' ').filter(w => w.length > 2);

    // 1. Try to find specific matches in DB
    let selectedInterests: { id: string; name: string }[] = [];

    try {
        // Search by name match
        const matches = await prisma.facebookInterest.findMany({
            where: {
                OR: keywords.map((k: string) => ({
                    name: { contains: k } // Default mode may satisfy, assuming MySQL case insensitive
                }))
            },
            take: 20
        });

        selectedInterests = matches.map((m: any) => ({ id: m.fbId, name: m.name }));

        // 2. If not enough, get random broad interests
        if (selectedInterests.length < 10) {
            const count = await prisma.facebookInterest.count();
            if (count > 0) {
                // Fetch random IDs? 
                // Creating a random skip
                const skip = Math.floor(Math.random() * Math.max(0, count - 20));
                const randoms = await prisma.facebookInterest.findMany({
                    take: 15,
                    skip: skip,
                    orderBy: { audienceSizeUpperBound: 'desc' } // Prefer larger audiences
                });

                const randomMapped = randoms.map((m: any) => ({ id: m.fbId, name: m.name }));

                // Merge unique
                const existingIds = new Set(selectedInterests.map((i: any) => i.id));
                randomMapped.forEach((r: any) => {
                    if (!existingIds.has(r.id)) {
                        selectedInterests.push(r);
                    }
                });
            }
        }

    } catch (e) {
        console.error("DB Targeting Error:", e);
        // Fallback to static if DB fails
        return {
            minAge: 20,
            maxAge: 65,
            interests: [] // Let the caller fallback or use defaults
        }
    }

    // Shuffle
    selectedInterests = selectedInterests.sort(() => Math.random() - 0.5);

    // Limit to 5-15
    const limit = 5 + Math.floor(Math.random() * 10);

    return {
        minAge: 20,
        maxAge: 65,
        interests: selectedInterests.slice(0, limit)
    };
}

