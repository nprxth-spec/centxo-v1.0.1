'use server';

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSystemStats() {
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user) {
        throw new Error("Unauthorized");
    }

    try {
        const [
            userCount,
            adAccountCount,
            campaignCount,
            adSetCount,
            adCount,
            teamMemberCount
        ] = await Promise.all([
            prisma.user.count(),
            prisma.account.count(),
            prisma.campaign.count(),
            prisma.adSet.count(),
            prisma.ad.count(),
            prisma.teamMember.count()
        ]);

        return {
            users: userCount,
            adAccounts: adAccountCount,
            campaigns: campaignCount,
            adSets: adSetCount,
            ads: adCount,
            teamMembers: teamMemberCount
        };
    } catch (error) {
        console.error("Error fetching system stats:", error);
        throw new Error("Failed to fetch system stats");
    }
}
