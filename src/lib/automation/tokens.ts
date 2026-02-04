import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';
import type { TokenInfo } from '@/lib/facebook/token-helper';

export async function buildTokensForUser(session: Session): Promise<TokenInfo[]> {
  const tokens: TokenInfo[] = [];
  const userId = session.user?.id;
  if (!userId) return tokens;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      metaAccount: { select: { accessToken: true } },
      accounts: {
        where: { provider: 'facebook' },
        select: { access_token: true },
      },
    },
  });
  if (!user) return tokens;

  if ((user as any).metaAccount?.accessToken) {
    try {
      const decrypted = decryptToken((user as any).metaAccount.accessToken);
      tokens.push({ token: decrypted, name: user.name || 'Main' });
    } catch {
      /* skip */
    }
  }

  for (const acc of (user as any).accounts || []) {
    if (acc.access_token && !tokens.some((t) => t.token === acc.access_token)) {
      tokens.push({ token: acc.access_token, name: user.name || 'Account' });
    }
  }

  const member = await prisma.teamMember.findFirst({
    where: { memberEmail: session.user?.email ?? undefined },
  });
  let ownerId = user.id;
  if (member?.userId) ownerId = member.userId;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    include: {
      metaAccount: { select: { accessToken: true } },
      accounts: {
        where: { provider: 'facebook' },
        select: { access_token: true },
      },
    },
  });

  if (owner?.metaAccount?.accessToken && ownerId !== user.id) {
    try {
      const decrypted = decryptToken(owner.metaAccount.accessToken);
      if (!tokens.some((t) => t.token === decrypted)) {
        tokens.push({ token: decrypted, name: owner.name || 'Team Owner' });
      }
    } catch {
      /* skip */
    }
  }

  for (const acc of (owner as any)?.accounts || []) {
    if (acc.access_token && !tokens.some((t) => t.token === acc.access_token)) {
      tokens.push({ token: acc.access_token, name: owner!.name || 'Team' });
    }
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: {
      userId: ownerId,
      memberType: 'facebook',
      facebookUserId: { not: null },
      accessToken: { not: null },
    },
  });
  for (const m of teamMembers as any[]) {
    if (m.accessToken && !tokens.some((t) => t.token === m.accessToken)) {
      tokens.push({ token: m.accessToken, name: m.facebookName || 'Member' });
    }
  }

  const sessionToken = (session as any).accessToken;
  if (sessionToken && !tokens.some((t) => t.token === sessionToken)) {
    tokens.push({ token: sessionToken, name: 'Session' });
  }

  return tokens;
}
