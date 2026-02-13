/**
 * Server-only: fetch team pages for a user (same list as /api/team/pages).
 * Used by team/config so adbox gets the exact pages the user selected on /account.
 * Includes host's own token (MetaAccount/Account) when no team members — so Subscription Manage shows pages after connecting in Connections.
 */
import { prisma } from '@/lib/prisma';
import { refreshTeamMemberTokenIfNeeded, refreshMetaAccountTokenIfNeeded } from '@/lib/facebook/refresh-token';
import { decryptToken } from '@/lib/services/metaClient';

export type TeamPage = {
  id: string;
  name: string;
  picture?: any;
  access_token?: string;
  business?: any;
  business_name?: string;
  _source?: { teamMemberId: string; facebookName: string | null; facebookUserId: string | null };
};

export type GetTeamPagesResult = {
  pages: TeamPage[];
  hint?: 'no_team_members' | 'fetch_failed'; // เมื่อได้ 0 หน้า: ไม่มีสมาชิกทีม vs โหลดจาก Meta ไม่สำเร็จ (โทเค็นหมดอายุ/โควต้า)
};

async function fetchAllMeAccounts(token: string): Promise<any[]> {
  const list: any[] = [];
  let url: string | null = `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,username,picture,access_token,business&limit=500&access_token=${token}`;
  while (url) {
    const res: Response = await fetch(url);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errorCode = errBody?.error?.code;
      const errorMessage = errBody?.error?.message || '';

      // Check if it's a permission error (especially business_management)
      if (errorCode === 200 || errorCode === 10 || errorMessage.includes('permission') || errorMessage.includes('business_management')) {
        console.warn('[team-pages] Permission error - token may not have business_management:', { code: errorCode, message: errorMessage });
        // Return empty list but don't break - let caller handle it
        return [];
      }

      console.warn('[team-pages] Meta me/accounts non-ok', { status: res.status, code: errorCode, message: errorMessage });
      break;
    }
    const json: { data?: unknown[]; error?: unknown; paging?: { next?: string } } = await res.json();
    if (json.error || !json.data) break;
    if (Array.isArray(json.data)) list.push(...json.data);
    const next: string | undefined = json.paging?.next;
    url = next ? (next.includes('access_token=') ? next : `${next}${next.includes('?') ? '&' : '?'}access_token=${token}`) : null;
  }
  return list;
}

export async function getTeamPagesForUser(
  userId: string,
  memberEmail?: string | null
): Promise<GetTeamPagesResult> {
  const { getTeamFacebookConnections } = await import('./team-connections-server');
  const connections = await getTeamFacebookConnections(userId, memberEmail);

  if (connections.length === 0) {
    return { pages: [], hint: 'no_team_members' };
  }

  const allPages: TeamPage[] = [];
  const seenPageIds = new Set<string>();
  const businessMap = new Map<string, string>();
  const pageToBusinessMap = new Map<string, string>();

  // Fetch all pages and build business maps from all connections
  for (const connection of connections) {
    try {
      const token = connection.accessToken;

      // First pass: Fetch ALL businesses to map page ownership and discover pages
      let bizUrl: string | null = `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,client_pages{id,name,picture,access_token,business},owned_pages{id,name,picture,access_token,business}&limit=500&access_token=${token}`;

      while (bizUrl) {
        const bizResponse: Response = await fetch(bizUrl);
        if (!bizResponse.ok) break;

        const bizData: any = await bizResponse.json();
        if (bizData.data && Array.isArray(bizData.data)) {
          bizData.data.forEach((b: any) => {
            businessMap.set(b.id, b.name);

            // Collect pages from both client_pages (shared to business) and owned_pages
            const bizPages = [...(b.client_pages?.data || []), ...(b.owned_pages?.data || [])];

            bizPages.forEach((p: any) => {
              pageToBusinessMap.set(p.id, b.name);

              // If we don't have this page yet from /me/accounts, add it here
              if (!seenPageIds.has(p.id) && p.access_token) {
                seenPageIds.add(p.id);
                allPages.push({
                  ...p,
                  business_name: b.name,
                  _source: {
                    teamMemberId: connection.source === 'teamMember' ? connection.id : '',
                    facebookName: connection.facebookName,
                    facebookUserId: connection.facebookUserId,
                  },
                });
              }
            });
          });
        }
        bizUrl = bizData.paging?.next || null;
      }

      // Second pass: Fetch pages (accounts)
      const dataList = await fetchAllMeAccounts(token);
      for (const page of dataList) {
        if (seenPageIds.has(page.id)) continue;
        seenPageIds.add(page.id);

        let businessName = page.business?.name;
        if (!businessName && page.business?.id) businessName = businessMap.get(page.business.id);
        if (!businessName) businessName = pageToBusinessMap.get(page.id);
        if (!businessName) businessName = page.business?.id ? `(Biz ID: ${page.business.id})` : 'Personal Page';

        allPages.push({
          ...page,
          business_name: businessName,
          _source: {
            teamMemberId: connection.source === 'teamMember' ? connection.id : '',
            facebookName: connection.facebookName,
            facebookUserId: connection.facebookUserId,
          },
        });
      }
    } catch (err) {
      console.error(`[getTeamPagesForUser] Error fetching for connection ${connection.facebookUserId}:`, err);
    }
  }

  if (allPages.length === 0) return { pages: [], hint: 'fetch_failed' };
  return { pages: allPages };
}
