import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { decryptToken } from '@/lib/services/metaClient';

export async function getTokenForAdVideos(actId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      metaAccount: { select: { accessToken: true } },
      accounts: { where: { provider: 'facebook' }, select: { access_token: true } },
    },
  });
  if (!user) return null;

  const tokens: TokenInfo[] = [];

  if ((user as any).metaAccount?.accessToken) {
    try {
      tokens.push({
        token: decryptToken((user as any).metaAccount.accessToken),
        name: user.name || 'Main',
      });
    } catch {
      tokens.push({
        token: (user as any).metaAccount.accessToken,
        name: user.name || 'Main (raw)',
      });
    }
  }
  (user as any).accounts?.forEach((acc: { access_token: string | null }) => {
    if (acc.access_token && !tokens.some((t) => t.token === acc.access_token)) {
      tokens.push({ token: acc.access_token, name: user.name || 'Account' });
    }
  });

  const member = await prisma.teamMember.findFirst({
    where: { memberEmail: session.user.email },
  });
  let ownerId = user.id;
  if (member?.userId) ownerId = member.userId;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    include: {
      metaAccount: { select: { accessToken: true } },
      accounts: { where: { provider: 'facebook' }, select: { access_token: true } },
    },
  });
  if (owner?.metaAccount?.accessToken && ownerId !== user.id) {
    try {
      const t = decryptToken(owner.metaAccount.accessToken);
      if (!tokens.some((x) => x.token === t)) {
        tokens.push({ token: t, name: owner.name || 'Owner' });
      }
    } catch {}
  }
  owner?.accounts?.forEach((acc: { access_token: string | null }) => {
    if (acc.access_token && !tokens.some((t) => t.token === acc.access_token)) {
      tokens.push({ token: acc.access_token, name: (owner?.name || 'Owner') + ' Account' });
    }
  });

  const team = await prisma.teamMember.findMany({
    where: { userId: ownerId, memberType: 'facebook', facebookUserId: { not: null }, accessToken: { not: null } },
  });
  team.forEach((m: { accessToken: string | null; facebookName: string | null }) => {
    if (m.accessToken && !tokens.some((t) => t.token === m.accessToken)) {
      tokens.push({ token: m.accessToken, name: m.facebookName || 'Member' });
    }
  });

  const sessionToken = (session as { accessToken?: string }).accessToken;
  if (sessionToken && !tokens.some((t) => t.token === sessionToken)) {
    tokens.push({ token: sessionToken, name: 'Session' });
  }

  if (tokens.length === 0) return null;
  return getValidTokenForAdAccount(actId, tokens);
}
