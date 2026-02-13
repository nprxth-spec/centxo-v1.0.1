/**
 * User Tokens Only - Meta Account Integrity Compliance
 * 
 * This module provides token collection functions that ONLY use tokens
 * belonging to the authenticated user. This complies with Meta's Account
 * Integrity Policy which prohibits sharing tokens between accounts.
 * 
 * For team collaboration, use Business Manager permissions instead of
 * sharing tokens between team members.
 */

import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/services/metaClient';
import type { TokenInfo } from './token-helper';

/**
 * Get tokens ONLY for the authenticated user (no team member tokens)
 * This complies with Meta Account Integrity Policy
 */
export async function getUserTokensOnly(session: Session): Promise<TokenInfo[]> {
  const tokens: TokenInfo[] = [];
  const userId = session.user?.id;
  
  if (!userId) {
    return tokens;
  }

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

  if (!user) {
    return tokens;
  }

  // 1. MetaAccount token (from Settings > Meta Connect)
  if ((user as any).metaAccount?.accessToken) {
    try {
      const decrypted = decryptToken((user as any).metaAccount.accessToken);
      if (decrypted && decrypted.length > 10) {
        tokens.push({ token: decrypted, name: user.name || 'Main' });
      }
    } catch {
      // If decryption fails, try raw token (might be unencrypted)
      const rawToken = (user as any).metaAccount.accessToken;
      if (rawToken && rawToken.length > 10) {
        tokens.push({ token: rawToken, name: user.name || 'Main (raw)' });
      }
    }
  }

  // 2. NextAuth Account tokens (from Facebook OAuth login)
  for (const acc of (user as any).accounts || []) {
    if (acc.access_token && !tokens.some((t) => t.token === acc.access_token)) {
      tokens.push({ token: acc.access_token, name: user.name || 'Account' });
    }
  }

  // 3. Session token (if available)
  const sessionToken = (session as any).accessToken;
  if (sessionToken && !tokens.some((t) => t.token === sessionToken)) {
    tokens.push({ token: sessionToken, name: 'Session' });
  }

  return tokens;
}

/**
 * Get a single token for the user (prefers MetaAccount, then Account, then Session)
 */
export async function getUserToken(session: Session): Promise<string | null> {
  const tokens = await getUserTokensOnly(session);
  return tokens.length > 0 ? tokens[0].token : null;
}
