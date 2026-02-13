/**
 * Meta Account Integrity Compliance: Use ONLY user's own tokens
 * 
 * This function has been updated to comply with Meta's Account Integrity Policy.
 * It no longer collects tokens from team members or team owners.
 * 
 * For team collaboration, use Business Manager permissions instead.
 */
import type { Session } from 'next-auth';
import { getUserTokensOnly } from '@/lib/facebook/user-tokens-only';
import type { TokenInfo } from '@/lib/facebook/token-helper';

/**
 * Build tokens for the authenticated user only (no team member tokens)
 * @deprecated Use getUserTokensOnly from '@/lib/facebook/user-tokens-only' instead
 */
export async function buildTokensForUser(session: Session): Promise<TokenInfo[]> {
  // Use the compliant version that only gets user's own tokens
  return getUserTokensOnly(session);
}
