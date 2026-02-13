/**
 * Proactive refresh of Facebook long-lived tokens.
 * Long-lived tokens last ~60 days; calling the exchange endpoint again before expiry
 * returns a new token with another ~60 days, so we extend when expiry is within threshold.
 */
import { prisma } from '@/lib/prisma';
import { exchangeForLongLivedToken } from '@/lib/facebook/token-helper';
import { decryptToken, encryptToken } from '@/lib/services/metaClient';

/** Extend token when it expires within this many days */
const REFRESH_THRESHOLD_DAYS = 7;
const REFRESH_THRESHOLD_MS = REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

function shouldRefresh(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  return msLeft < REFRESH_THRESHOLD_MS;
}

export type RefreshResult = { token: string; didExtend: boolean };

/**
 * If the team member's token expires within the threshold, extend it and update DB.
 * Returns the token to use and whether it was extended (caller can skip expiry check when didExtend).
 */
export async function refreshTeamMemberTokenIfNeeded(member: {
  id: string;
  accessToken: string | null;
  accessTokenExpires: Date | null;
}): Promise<RefreshResult | null> {
  if (!member.accessToken) return null;
  if (!shouldRefresh(member.accessTokenExpires)) return { token: member.accessToken, didExtend: false };

  try {
    const { accessToken: newToken, expiresIn } = await exchangeForLongLivedToken(member.accessToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await prisma.teamMember.update({
      where: { id: member.id },
      data: { accessToken: newToken, accessTokenExpires: expiresAt, updatedAt: new Date() },
    });
    console.log(`[refresh-token] Extended TeamMember ${member.id} token to ${expiresAt.toISOString()}`);
    return { token: newToken, didExtend: true };
  } catch (err) {
    console.warn('[refresh-token] TeamMember token extend failed, using existing:', (err as Error).message);
    return { token: member.accessToken, didExtend: false };
  }
}

/**
 * If the MetaAccount token expires within the threshold, extend it and update DB.
 * Returns the decrypted token to use (existing or newly refreshed).
 */
export async function refreshMetaAccountTokenIfNeeded(metaAccount: {
  userId: string;
  id: string;
  accessToken: string;
  accessTokenExpires: Date;
}): Promise<string | null> {
  if (!metaAccount.accessToken) return null;
  if (!shouldRefresh(metaAccount.accessTokenExpires)) {
    try {
      return decryptToken(metaAccount.accessToken);
    } catch {
      return null;
    }
  }

  try {
    const currentToken = decryptToken(metaAccount.accessToken);
    const { accessToken: newToken, expiresIn } = await exchangeForLongLivedToken(currentToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const encrypted = encryptToken(newToken);
    await prisma.metaAccount.update({
      where: { id: metaAccount.id },
      data: { accessToken: encrypted, accessTokenExpires: expiresAt, updatedAt: new Date() },
    });
    console.log(`[refresh-token] Extended MetaAccount ${metaAccount.id} token to ${expiresAt.toISOString()}`);
    return newToken;
  } catch (err) {
    console.warn('[refresh-token] MetaAccount token extend failed, using existing:', (err as Error).message);
    try {
      return decryptToken(metaAccount.accessToken);
    } catch {
      return null;
    }
  }
}
