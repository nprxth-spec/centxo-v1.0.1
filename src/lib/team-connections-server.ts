import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';
import { refreshTeamMemberTokenIfNeeded, refreshMetaAccountTokenIfNeeded } from '@/lib/facebook/refresh-token';

export type TeamConnection = {
    id: string; // Source ID (TeamMember.id or MetaAccount.id)
    source: 'teamMember' | 'metaAccount';
    facebookUserId: string;
    facebookName: string;
    accessToken: string;
    expiresAt: Date | null;
};

/**
 * Gathers all unique Facebook connections for a team (Host + Members).
 */
export async function getTeamFacebookConnections(
    userId: string,
    memberEmail?: string | null
): Promise<TeamConnection[]> {
    // 1. Identify the Host and Team Participants
    let hostId = userId;

    // Check if the current user is a member of someone else's team
    const membership = await prisma.teamMember.findFirst({
        where: {
            memberEmail: memberEmail || undefined,
            memberType: 'email',
        },
        select: { userId: true },
    });

    if (membership) {
        hostId = membership.userId;
    }

    // 2. Gather all direct Facebook connections (TeamMember where type=facebook)
    const facebookTeamMembers = await prisma.teamMember.findMany({
        where: {
            userId: hostId,
            memberType: 'facebook',
            facebookUserId: { not: null },
            accessToken: { not: null },
        },
    });

    // 3. Gather all MetaAccounts from participants
    // Participants = Host + Email Members
    const emailMembers = await prisma.teamMember.findMany({
        where: {
            userId: hostId,
            memberType: 'email',
            memberEmail: { not: null },
        },
        select: { memberEmail: true },
    });

    const participantEmails = new Set<string>();
    const hostUser = await prisma.user.findUnique({ where: { id: hostId }, select: { email: true } });
    if (hostUser?.email) participantEmails.add(hostUser.email.trim());

    emailMembers.forEach(m => {
        if (m.memberEmail) participantEmails.add(m.memberEmail.trim());
    });

    const activeParticipantEmails = Array.from(participantEmails).filter(Boolean);

    const usersWithConnections = await prisma.user.findMany({
        where: { email: { in: activeParticipantEmails } },
        select: {
            id: true,
            name: true,
            metaAccount: {
                select: {
                    id: true,
                    metaUserId: true,
                    accessToken: true,
                    accessTokenExpires: true,
                }
            },
            accounts: {
                where: { provider: 'facebook' },
                select: {
                    access_token: true,
                    expires_at: true,
                    providerAccountId: true,
                }
            }
        }
    });

    const connections: TeamConnection[] = [];
    const seenFacebookUserIds = new Set<string>();

    // Process TeamMember (facebook) connections
    for (const member of facebookTeamMembers) {
        if (member.facebookUserId && !seenFacebookUserIds.has(member.facebookUserId)) {
            try {
                const refreshed = await refreshTeamMemberTokenIfNeeded(member as any);
                if (refreshed) {
                    connections.push({
                        id: member.id,
                        source: 'teamMember',
                        facebookUserId: member.facebookUserId,
                        facebookName: member.facebookName || 'Facebook User',
                        accessToken: refreshed.token,
                        expiresAt: member.accessTokenExpires,
                    });
                    seenFacebookUserIds.add(member.facebookUserId);
                }
            } catch (e) {
                console.error(`Failed to refresh TeamMember token for ${member.facebookUserId}:`, e);
            }
        }
    }

    // Process MetaAccount and Account connections
    for (const u of usersWithConnections) {
        // Priority 1: MetaAccount (usually has broader permissions if they went through our connect flow)
        if (u.metaAccount && !seenFacebookUserIds.has(u.metaAccount.metaUserId)) {
            try {
                // We need to refreshMetaAccountTokenIfNeeded which expects a specific object
                const metaAccountObj = {
                    ...u.metaAccount,
                    userId: u.id,
                } as any;

                let token = await refreshMetaAccountTokenIfNeeded(metaAccountObj);
                if (!token) {
                    try {
                        token = decryptToken(u.metaAccount.accessToken);
                    } catch {
                        token = u.metaAccount.accessToken;
                    }
                }

                if (token) {
                    // Self-healing: Try to get the real Facebook name
                    let facebookName = u.name || 'Facebook User';

                    // 1. Try to find a TeamMember record for this facebookUserId
                    const fbMember = await prisma.teamMember.findUnique({
                        where: { facebookUserId: u.metaAccount.metaUserId }
                    });

                    if (fbMember?.facebookName) {
                        facebookName = fbMember.facebookName;
                    } else {
                        // 2. Fetch from Meta API as a fallback
                        try {
                            const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=name&access_token=${token}`);
                            if (meRes.ok) {
                                const meData = await meRes.json();
                                if (meData.name) {
                                    facebookName = meData.name;
                                    // Cache it in TeamMember for future
                                    await prisma.teamMember.upsert({
                                        where: { facebookUserId: u.metaAccount.metaUserId },
                                        update: { facebookName: meData.name, updatedAt: new Date() },
                                        create: {
                                            userId: u.id,
                                            memberType: 'facebook',
                                            facebookUserId: u.metaAccount.metaUserId,
                                            facebookName: meData.name,
                                            accessToken: token,
                                            role: 'MEMBER'
                                        }
                                    });
                                }
                            }
                        } catch (apiErr) {
                            console.warn(`[getTeamFacebookConnections] Failed to fetch name from Meta:`, apiErr);
                        }
                    }

                    connections.push({
                        id: u.metaAccount.id,
                        source: 'metaAccount',
                        facebookUserId: u.metaAccount.metaUserId,
                        facebookName,
                        accessToken: token,
                        expiresAt: u.metaAccount.accessTokenExpires,
                    });
                    seenFacebookUserIds.add(u.metaAccount.metaUserId);
                }
            } catch (e) {
                console.error(`Failed to refresh MetaAccount token for ${u.metaAccount.metaUserId}:`, e);
            }
        }

        // Priority 2: NextAuth Account table (fallback - can have multiple provider accounts)
        for (const fbAccount of u.accounts) {
            if (fbAccount.access_token && !seenFacebookUserIds.has(fbAccount.providerAccountId)) {
                connections.push({
                    id: `nextauth-${u.id}-${fbAccount.providerAccountId}`,
                    source: 'metaAccount', // Treat similarly as a user-linked account
                    facebookUserId: fbAccount.providerAccountId,
                    facebookName: u.name || 'Facebook User (NextAuth)',
                    accessToken: fbAccount.access_token,
                    expiresAt: fbAccount.expires_at ? new Date(fbAccount.expires_at * 1000) : null,
                });
                seenFacebookUserIds.add(fbAccount.providerAccountId);
            }
        }
    }

    return connections;
}
