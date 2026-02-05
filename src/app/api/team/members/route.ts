import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get current user
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                isTeamHost: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if user is a team member of another team
        const membershipTeam = await prisma.teamMember.findFirst({
            where: {
                memberEmail: session.user.email,
                memberType: 'email',
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
        });

        let host;
        let teamMembers;

        if (membershipTeam) {
            // User is a team member, show their host's team
            host = {
                id: membershipTeam.user.id,
                name: membershipTeam.user.name,
                email: membershipTeam.user.email,
                image: membershipTeam.user.image,
                role: 'OWNER',
            };

            // Get all team members of the host
            teamMembers = await prisma.teamMember.findMany({
                where: { userId: membershipTeam.userId },
                orderBy: { addedAt: 'asc' },
            });
        } else {
            // User is the host, show their own team
            host = {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                role: 'OWNER',
            };

            // Get team members that this user owns
            teamMembers = await prisma.teamMember.findMany({
                where: { userId: user.id },
                orderBy: { addedAt: 'asc' },
            });
        }

        return NextResponse.json({
            host,
            members: await Promise.all(teamMembers.map(async (member: any) => {
                let memberImage = null;

                // If email member, try to get profile image from User table
                if (member.memberType === 'email' && member.memberEmail) {
                    const userRecord = await prisma.user.findUnique({
                        where: { email: member.memberEmail.trim() },
                        select: { image: true },
                    });
                    memberImage = userRecord?.image || null;
                }
                // If Facebook member, construct Graph API image URL
                else if (member.memberType === 'facebook' && member.facebookUserId) {
                    memberImage = `/api/facebook/profile-picture?userId=${encodeURIComponent(member.facebookUserId)}`;
                }

                return {
                    id: member.id,
                    memberType: member.memberType,
                    facebookUserId: member.facebookUserId,
                    facebookName: member.facebookName,
                    facebookEmail: member.facebookEmail,
                    memberEmail: member.memberEmail,
                    memberName: member.memberName,
                    memberImage: memberImage, // Add profile image
                    role: member.role,
                    addedAt: member.addedAt,
                    lastUsedAt: member.lastUsedAt,
                };
            })),
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
            }
        });
    } catch (error) {
        console.error('Error fetching team members:', error);
        return NextResponse.json(
            { error: 'Failed to fetch team members' },
            { status: 500 }
        );
    }
}
