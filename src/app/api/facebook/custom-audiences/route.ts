import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { type TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { decryptToken } from '@/lib/services/metaClient';

export const dynamic = 'force-dynamic';

/** Collect tokens from user, team owner, team members (same as beneficiaries) */
async function collectTokens(session: { user?: { id?: string; email?: string | null } }) {
  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
    include: {
      metaAccount: { select: { accessToken: true } },
      accounts: { where: { provider: 'facebook' }, select: { access_token: true } },
    },
  });
  if (!user) return [];

  const tokens: TokenInfo[] = [];
  if ((user as any).metaAccount?.accessToken) {
    try {
      tokens.push({ token: decryptToken((user as any).metaAccount.accessToken), name: user.name || 'Main' });
    } catch {
      tokens.push({ token: (user as any).metaAccount.accessToken, name: user.name || 'Main (raw)' });
    }
  }
  (user as any).accounts?.forEach((acc: { access_token: string | null }) => {
    if (acc.access_token && !tokens.some((t) => t.token === acc.access_token)) {
      tokens.push({ token: acc.access_token, name: user.name || 'Account' });
    }
  });

  const memberRec = await prisma.teamMember.findFirst({ where: { memberEmail: session!.user!.email } });
  let teamOwnerId = user.id;
  if (memberRec?.userId) teamOwnerId = memberRec.userId;

  const teamOwner = await prisma.user.findUnique({
    where: { id: teamOwnerId },
    include: { metaAccount: { select: { accessToken: true } }, accounts: { where: { provider: 'facebook' }, select: { access_token: true } } },
  });
  if (teamOwner?.metaAccount?.accessToken && teamOwnerId !== user.id) {
    try {
      const dec = decryptToken(teamOwner.metaAccount.accessToken);
      if (!tokens.some((t) => t.token === dec)) tokens.push({ token: dec, name: teamOwner.name || 'Owner' });
    } catch { /* ignore */ }
  }
  teamOwner?.accounts?.forEach((acc: { access_token: string | null }) => {
    if (acc.access_token && !tokens.some((t) => t.token === acc.access_token)) {
      tokens.push({ token: acc.access_token, name: (teamOwner?.name ?? 'Owner') + ' Account' });
    }
  });

  const members = await prisma.teamMember.findMany({
    where: { userId: teamOwnerId, memberType: 'facebook', facebookUserId: { not: null }, accessToken: { not: null } },
  });
  members.forEach((m: { accessToken: string | null; facebookName: string | null }) => {
    if (m.accessToken && !tokens.some((t) => t.token === m.accessToken)) {
      tokens.push({ token: m.accessToken, name: m.facebookName || 'Member' });
    }
  });

  const sessionToken = (session as { accessToken?: string }).accessToken;
  if (sessionToken && !tokens.some((t) => t.token === sessionToken)) {
    tokens.push({ token: sessionToken, name: 'Session' });
  }
  return tokens;
}

/** GET: List custom audiences for an ad account */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adAccountId = request.nextUrl.searchParams.get('adAccountId');
    if (!adAccountId) return NextResponse.json({ error: 'adAccountId required' }, { status: 400 });

    const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const tokens = await collectTokens(session);
    const accessToken = await getValidTokenForAdAccount(actId, tokens);
    if (!accessToken) {
      return NextResponse.json({ error: 'No valid token for this ad account' }, { status: 400 });
    }

    const url = `https://graph.facebook.com/v22.0/${actId}/customaudiences?fields=id,name,subtype,time_created&limit=100&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      const msg = data.error.error_user_msg || data.error.message || 'Failed to fetch audiences';
      console.warn('[custom-audiences] Meta API error:', data.error);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Meta may return subtype=null for engagement audiences (deprecated since 2018) — show all audiences
    const raw = data.data || [];
    const audiences = raw.filter((a: any) => a?.id);

    if (raw.length > 0 && audiences.length === 0) {
      console.warn('[custom-audiences] Filtered out all items. Raw sample:', JSON.stringify(raw[0]));
    }

    return NextResponse.json({ audiences });
  } catch (e: any) {
    console.error('Custom audiences GET error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

/** POST: Create engagement custom audience (people who messaged selected pages) */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { adAccountId, name, pageIds, retentionDays } = body;
    if (!adAccountId || !name || !pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json({ error: 'adAccountId, name, and pageIds (array) required' }, { status: 400 });
    }

    const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const tokens = await collectTokens(session);
    const accessToken = await getValidTokenForAdAccount(actId, tokens);
    if (!accessToken) {
      return NextResponse.json({ error: 'No valid token for this ad account' }, { status: 400 });
    }

    const retentionSeconds = Math.min(365 * 24 * 3600, Math.max(1, (retentionDays || 365) * 24 * 3600));
    const validPageIds = pageIds.map((id: string) => String(id).trim()).filter(Boolean);

    // Meta docs: "You can have a different page for each rule" — one rule per page ensures all pages are included
    const rule = {
      inclusions: {
        operator: 'or',
        rules: validPageIds.map((pageId: string) => ({
          event_sources: [{ id: pageId, type: 'page' }],
          retention_seconds: retentionSeconds,
          filter: {
            operator: 'and',
            filters: [{ field: 'event', operator: 'eq', value: 'page_messaged' }],
          },
        })),
      },
    };

    const formData = new FormData();
    formData.append('name', String(name).slice(0, 200));
    formData.append('rule', JSON.stringify(rule));
    formData.append('prefill', '1');
    formData.append('access_token', accessToken);

    const res = await fetch(`https://graph.facebook.com/v22.0/${actId}/customaudiences`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (data.error) {
      const msg = data.error.error_user_msg || data.error.message || 'Failed to create audience';
      if (msg.includes('page_messaged') || msg.includes('Europe')) {
        return NextResponse.json({
          error: 'page_messaged อาจไม่รองรับในภูมิภาคของคุณ (Europe มีข้อจำกัดด้านความเป็นส่วนตัว) ลองใช้ page_engaged แทน',
        }, { status: 400 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ audience: data, id: data.id });
  } catch (e: any) {
    console.error('Custom audiences POST error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
