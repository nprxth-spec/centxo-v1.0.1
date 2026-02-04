import { prisma } from '@/lib/prisma';
import { Session } from 'next-auth';

/**
 * Check if a user is a team member of another user
 * @param userEmail - Email of the user checking access
 * @param hostUserId - ID of the team host
 * @returns True if user is a team member, false otherwise
 */
export async function isTeamMemberOf(
  userEmail: string,
  hostUserId: string
): Promise<boolean> {
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      userId: hostUserId,
      memberEmail: userEmail,
      memberType: 'email',
    },
  });

  return !!teamMember;
}

/**
 * Get all host user IDs where the current user is a team member
 * @param userEmail - Email of the team member
 * @returns Array of host user IDs
 */
export async function getTeamHostIds(userEmail: string): Promise<string[]> {
  const memberships = await prisma.teamMember.findMany({
    where: {
      memberEmail: userEmail,
      memberType: 'email',
    },
    select: {
      userId: true,
    },
  });

  return memberships.map((m) => m.userId);
}

/**
 * Get effective user ID for resource access
 * Returns the user's own ID plus all team host IDs they belong to
 * @param session - NextAuth session
 * @returns Array of user IDs that can access resources
 */
export async function getEffectiveUserIds(
  session: Session | null
): Promise<string[]> {
  if (!session?.user?.id || !session?.user?.email) {
    return [];
  }

  const userIds = [session.user.id];

  // If user is a team member, add their host IDs
  const hostIds = await getTeamHostIds(session.user.email);
  userIds.push(...hostIds);

  return userIds;
}

/**
 * Check if user can access a specific resource
 * @param session - NextAuth session
 * @param resourceUserId - User ID that owns the resource
 * @returns True if user can access, false otherwise
 */
export async function canAccessResource(
  session: Session | null,
  resourceUserId: string
): Promise<boolean> {
  if (!session?.user?.id) {
    return false;
  }

  // Check if it's their own resource
  if (session.user.id === resourceUserId) {
    return true;
  }

  // Check if user is a team member of the resource owner
  if (session.user.email) {
    return await isTeamMemberOf(session.user.email, resourceUserId);
  }

  return false;
}
