/**
 * Invalidate in-memory caches for team/config and team/ad-accounts.
 * Called when user connects Facebook so next fetch gets fresh data.
 */

declare global {
  var _teamConfigCache: Record<string, { data: any; timestamp: number }> | undefined;
  var _adAccountCache: Record<string, { data: any; timestamp: number }> | undefined;
}

export function invalidateTeamCachesForUser(userId: string): void {
  const configKey = `config_v11_${userId}`;
  const adAccountsKey = `ad_accounts_v6_${userId}`;

  if (typeof globalThis._teamConfigCache !== 'undefined') {
    delete globalThis._teamConfigCache[configKey];
  }
  if (typeof globalThis._adAccountCache !== 'undefined') {
    delete globalThis._adAccountCache[adAccountsKey];
  }
}
