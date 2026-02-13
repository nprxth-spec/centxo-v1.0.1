import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';

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

        // Get current user and their MetaAccount
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                isTeamHost: true,
                metaAccount: {
                    select: {
                        id: true,
                        metaUserId: true,
                        accessToken: true,
                        accessTokenExpires: true,
                    }
                }
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
        let teamId;

        if (membershipTeam) {
            // User is a team member, show their host's team
            host = {
                id: membershipTeam.user.id,
                name: membershipTeam.user.name,
                email: membershipTeam.user.email,
                image: membershipTeam.user.image,
                role: 'OWNER',
            };
            teamId = membershipTeam.userId;

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
            teamId = user.id;

            // Get team members that this user owns
            teamMembers = await prisma.teamMember.findMany({
                where: { userId: user.id },
                orderBy: { addedAt: 'asc' },
            });
        }

        // Include all team members (email + Facebook) so Employees and Admins all show in Manage Access
        const finalTeamMembers = teamMembers;

        // Build list of ALL Facebook connections in the team — Owner, Admin, Employee
        const facebookConnections: { id: string; name: string; email: string; image: string | null; role: string; roleLabel: string }[] = [];
        const roleLabelMap: Record<string, string> = { ADMIN: 'Admin', EMPLOYEE: 'Employee', OWNER: 'Owner' };
        const seenFacebookUserIds = new Set<string>();
        const hostHasFacebookMember = finalTeamMembers.some((m: any) => m.memberType === 'facebook' && m.userId === teamId);

        const hostUser = await prisma.user.findUnique({
            where: { id: teamId },
            select: {
                id: true,
                metaAccount: { select: { id: true, metaUserId: true, accessToken: true } },
                accounts: { where: { provider: 'facebook' }, select: { access_token: true, providerAccountId: true } },
            },
        });
        const hostHasFacebook = !!hostUser?.metaAccount || (hostUser?.accounts?.length ?? 0) > 0;

        // Host: add row with Facebook name/email (from Graph API if no TeamMember facebook record)
        if (hostHasFacebook && hostUser && !hostHasFacebookMember) {
            let fbName = '';
            let fbEmail = '';
            let fbImage: string | null = null;
            let fbUserId: string | null = null;
            let accessToken: string | null = null;
            if (hostUser.metaAccount?.accessToken) {
                fbUserId = hostUser.metaAccount.metaUserId;
                try {
                    accessToken = decryptToken(hostUser.metaAccount.accessToken);
                } catch {
                    accessToken = hostUser.metaAccount.accessToken;
                }
            } else if ((hostUser.accounts as any)?.[0]?.access_token) {
                const acc = (hostUser.accounts as any)[0];
                fbUserId = acc.providerAccountId;
                accessToken = acc.access_token;
            }
            if (accessToken && fbUserId && !seenFacebookUserIds.has(fbUserId)) {
                try {
                    const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`);
                    const me = await meRes.json();
                    if (me.name) fbName = me.name;
                    if (me.email) fbEmail = me.email; // only Facebook email, not ID
                    if (me.picture?.data?.url) fbImage = me.picture.data.url;
                } catch (e) {
                    console.warn('Failed to fetch host Facebook profile:', e);
                }
                seenFacebookUserIds.add(fbUserId);
                facebookConnections.push({
                    id: hostUser.id,
                    name: fbName,
                    email: fbEmail || '', // only Facebook email, not ID
                    image: fbImage,
                    role: 'OWNER',
                    roleLabel: 'Owner',
                });
            }
        }

        // Facebook-type members: fetch name/email/picture from Graph API for each one
        for (const member of finalTeamMembers) {
            if (member.memberType !== 'facebook') continue;
            const isHost = member.userId === teamId;
            const fbUserId = member.facebookUserId;
            if (fbUserId && seenFacebookUserIds.has(fbUserId)) continue;

            let fbName = member.facebookName ?? '';
            let fbEmail = member.facebookEmail ?? '';
            let fbImage: string | null = null;

            // Always call Graph API to get fresh name, email & picture
            if (member.accessToken) {
                try {
                    const meRes = await fetch(
                        `https://graph.facebook.com/v22.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(member.accessToken)}`
                    );
                    const me = await meRes.json();
                    if (me.name) fbName = me.name;
                    if (me.email) fbEmail = me.email;
                    if (me.picture?.data?.url) fbImage = me.picture.data.url;

                    // Backfill DB if facebookEmail was missing
                    if (me.email && !member.facebookEmail) {
                        prisma.teamMember.update({
                            where: { id: member.id },
                            data: { facebookEmail: me.email, facebookName: me.name || member.facebookName },
                        }).catch(() => {}); // fire-and-forget
                    }
                } catch {
                    // fallback to profile picture endpoint
                    if (member.facebookUserId) {
                        fbImage = `/api/facebook/profile-picture?userId=${encodeURIComponent(member.facebookUserId)}`;
                    }
                }
            } else if (member.facebookUserId) {
                fbImage = `/api/facebook/profile-picture?userId=${encodeURIComponent(member.facebookUserId)}`;
            }

            if (fbUserId) seenFacebookUserIds.add(fbUserId);
            facebookConnections.push({
                id: member.id,
                name: fbName,
                email: fbEmail,
                image: fbImage,
                role: isHost ? 'OWNER' : member.role,
                roleLabel: isHost ? 'Owner' : (roleLabelMap[member.role] || member.role),
            });
        }

        // Email members (Admin/Employee): add their Facebook connections if they've connected via Meta OAuth
        const emailMembers = finalTeamMembers.filter((m: any) => m.memberType === 'email' && m.memberEmail);
        for (const member of emailMembers) {
            const memberUser = await prisma.user.findUnique({
                where: { email: member.memberEmail.trim() },
                select: {
                    id: true,
                    metaAccount: { select: { metaUserId: true, accessToken: true } },
                    accounts: { where: { provider: 'facebook' }, select: { access_token: true, providerAccountId: true } },
                },
            });
            if (!memberUser) continue;

            let accessToken: string | null = null;
            let fbUserId: string | null = null;
            if (memberUser.metaAccount?.accessToken) {
                fbUserId = memberUser.metaAccount.metaUserId;
                try {
                    accessToken = decryptToken(memberUser.metaAccount.accessToken);
                } catch {
                    accessToken = memberUser.metaAccount.accessToken;
                }
            } else if ((memberUser.accounts as any)?.[0]?.access_token) {
                const acc = (memberUser.accounts as any)[0];
                fbUserId = acc.providerAccountId;
                accessToken = acc.access_token;
            }
            if (!accessToken || !fbUserId || seenFacebookUserIds.has(fbUserId)) continue;

            let fbName = '';
            let fbEmail = '';
            let fbImage: string | null = null;
            try {
                const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`);
                const me = await meRes.json();
                if (me.name) fbName = me.name;
                if (me.email) fbEmail = me.email;
                if (me.picture?.data?.url) fbImage = me.picture.data.url;
            } catch (e) {
                console.warn('Failed to fetch email member Facebook profile:', e);
            }

            seenFacebookUserIds.add(fbUserId);
            facebookConnections.push({
                id: `email-${member.id}`,
                name: fbName,
                email: fbEmail || '',
                image: fbImage,
                role: member.role,
                roleLabel: roleLabelMap[member.role] || member.role,
            });
        }

        // Build a map of email → facebookConnection so we can show which FB account each email member linked
        const emailToFb = new Map<string, { name: string; email: string }>();
        for (const fc of facebookConnections) {
            // Host's FB row: map host.email → fc
            if (fc.role === 'OWNER' && host?.email) {
                emailToFb.set(host.email.toLowerCase(), { name: fc.name, email: fc.email });
            }
            // Email members' FB (id format: email-{memberId})
            if (fc.id.startsWith('email-')) {
                const memberId = fc.id.replace(/^email-/, '');
                const member = finalTeamMembers.find((m: any) => m.id === memberId && m.memberEmail);
                if (member?.memberEmail) {
                    emailToFb.set(member.memberEmail.toLowerCase(), { name: fc.name, email: fc.email });
                }
            }
        }
        // Match facebook-type TeamMembers to email members (user may have both)
        const emailMemberUserIds = new Map<string, string>();
        for (const member of finalTeamMembers) {
            if (member.memberType === 'email' && member.memberEmail) {
                const u = await prisma.user.findUnique({
                    where: { email: member.memberEmail.trim() },
                    select: { id: true },
                });
                if (u) emailMemberUserIds.set(member.memberEmail.toLowerCase(), u.id);
            }
        }
        for (const [email, userId] of emailMemberUserIds.entries()) {
            if (emailToFb.has(email)) continue;
            const memberUser = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    metaAccount: { select: { metaUserId: true } },
                    accounts: { where: { provider: 'facebook' }, select: { providerAccountId: true } },
                },
            });
            const fbUserId = memberUser?.metaAccount?.metaUserId || memberUser?.accounts?.[0]?.providerAccountId;
            if (fbUserId) {
                const fcMember = finalTeamMembers.find((m: any) => m.memberType === 'facebook' && m.facebookUserId === fbUserId);
                if (fcMember) {
                    const match = facebookConnections.find(fc => fc.id === fcMember.id);
                    if (match) emailToFb.set(email, { name: match.name, email: match.email });
                }
            }
        }

        const membersPayload = await Promise.all(finalTeamMembers.map(async (member: any) => {
            let memberImage = null;
            if (member.memberEmail) {
                const userRecord = await prisma.user.findUnique({
                    where: { email: member.memberEmail.trim() },
                    select: { image: true },
                });
                memberImage = userRecord?.image || null;
            } else if (member.memberType === 'facebook' && member.facebookUserId) {
                memberImage = `/api/facebook/profile-picture?userId=${encodeURIComponent(member.facebookUserId)}`;
            }

            // Attach linked Facebook info for email members
            const linkedFb = member.memberEmail
                ? emailToFb.get(member.memberEmail.toLowerCase()) || null
                : null;

            return {
                id: member.id,
                memberType: member.memberType,
                facebookUserId: member.facebookUserId,
                facebookName: member.facebookName,
                facebookEmail: member.facebookEmail,
                memberEmail: member.memberEmail,
                memberName: member.memberName,
                memberImage: memberImage,
                role: member.role,
                addedAt: member.addedAt,
                lastUsedAt: member.lastUsedAt,
                linkedFacebook: linkedFb, // { name, email } or null
            };
        }));

        return NextResponse.json({
            host,
            members: membersPayload,
            facebookConnections,
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
