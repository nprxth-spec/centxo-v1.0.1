import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { type TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { decryptToken } from '@/lib/services/metaClient';

export const dynamic = 'force-dynamic';

/**
 * Collect tokens from authenticated user ONLY (Meta Account Integrity compliance)
 * No longer collects tokens from team members or team owners.
 * For team collaboration, use Business Manager permissions instead.
 */
async function collectTokens(session: { user?: { id?: string; email?: string | null } }): Promise<TokenInfo[]> {
  const { getUserTokensOnly } = await import('@/lib/facebook/user-tokens-only');
  return getUserTokensOnly(session as any);
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

const ENGAGEMENT_EVENTS = [
  'page_engaged',
  'page_visited',
  'page_messaged',
  'page_post_interaction',
  'page_cta_clicked',
  'page_or_post_save',
  'page_liked',
] as const;

/** POST: Create engagement custom audience or lookalike */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      adAccountId,
      adAccountIds,
      name,
      pageIds,
      retentionDays,
      audienceType = 'page_messaged',
      audienceTypes,
      action = 'create_engagement',
      originAudienceId,
      lookalikeCountry = 'TH',
      lookalikeRatio = 0.01,
      lookalikeType = 'similarity',
    } = body;

    const accountIds: string[] = adAccountIds && Array.isArray(adAccountIds) && adAccountIds.length > 0
      ? adAccountIds.map((id: string) => (String(id || '').startsWith('act_') ? String(id) : `act_${id}`)).filter(Boolean)
      : adAccountId ? [(String(adAccountId).startsWith('act_') ? adAccountId : `act_${adAccountId}`)] : [];

    if (accountIds.length === 0) {
      return NextResponse.json({ error: 'adAccountId or adAccountIds required' }, { status: 400 });
    }

    const tokens = await collectTokens(session);
    const results: { accountId: string; id?: string; error?: string }[] = [];

    if (action === 'create_lookalike') {
      if (!originAudienceId || !name) {
        return NextResponse.json({ error: 'originAudienceId and name required for lookalike' }, { status: 400 });
      }
      const lookalikeSpec = {
        type: lookalikeType === 'reach' ? 'reach' : 'similarity',
        country: lookalikeCountry || 'TH',
        ratio: Math.min(0.2, Math.max(0.01, parseFloat(String(lookalikeRatio)) || 0.01)),
      };
      for (const actId of accountIds) {
        const accessToken = await getValidTokenForAdAccount(actId, tokens);
        if (!accessToken) {
          results.push({ accountId: actId, error: 'No valid token' });
          continue;
        }
        const fd = new FormData();
        fd.append('name', String(name).slice(0, 200));
        fd.append('subtype', 'LOOKALIKE');
        fd.append('origin_audience_id', String(originAudienceId));
        fd.append('lookalike_spec', JSON.stringify(lookalikeSpec));
        fd.append('access_token', accessToken);
        const res = await fetch(`https://graph.facebook.com/v22.0/${actId}/customaudiences`, { method: 'POST', body: fd });
        const data = await res.json();
        if (data.error) {
          results.push({ accountId: actId, error: data.error.error_user_msg || data.error.message });
        } else {
          results.push({ accountId: actId, id: data.id });
        }
      }
      return NextResponse.json({ results, audience: results[0]?.id ? { id: results[0].id } : null });
    }

    if (action === 'delete') {
      const { audienceId } = body;
      if (!audienceId || !adAccountId) {
        return NextResponse.json({ error: 'audienceId and adAccountId required for delete' }, { status: 400 });
      }
      const actId = String(adAccountId).startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const tokens = await collectTokens(session);
      const accessToken = await getValidTokenForAdAccount(actId, tokens);
      if (!accessToken) {
        return NextResponse.json({ error: 'No valid token for this ad account' }, { status: 400 });
      }
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${audienceId}?access_token=${accessToken}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.error) {
        return NextResponse.json({ error: data.error.error_user_msg || data.error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (!name || !pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json({ error: 'name and pageIds (array) required' }, { status: 400 });
    }

    const validPageIds = pageIds.map((id: string) => String(id).trim()).filter(Boolean);
    const events = audienceTypes && Array.isArray(audienceTypes) && audienceTypes.length > 0
      ? audienceTypes.filter((e: string) => ENGAGEMENT_EVENTS.includes(e as any))
      : [audienceType && ENGAGEMENT_EVENTS.includes(audienceType) ? audienceType : 'page_messaged'];

    const baseRetention = Math.min(730 * 24 * 3600, Math.max(1, (retentionDays || 365) * 24 * 3600));

    const inclusionRules: any[] = [];
    for (const pageId of validPageIds) {
      for (const event of events) {
        const retentionSeconds = event === 'page_liked' ? 0 : baseRetention;
        inclusionRules.push({
          event_sources: [{ id: pageId, type: 'page' }],
          retention_seconds: retentionSeconds,
          filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: event }] },
        });
      }
    }

    const RULES_PER_AUDIENCE = 5;
    const ruleChunks: any[][] = [];
    for (let i = 0; i < inclusionRules.length; i += RULES_PER_AUDIENCE) {
      ruleChunks.push(inclusionRules.slice(i, i + RULES_PER_AUDIENCE));
    }

    const baseName = String(name).slice(0, 180);

    for (const actId of accountIds) {
      const accessToken = await getValidTokenForAdAccount(actId, tokens);
      if (!accessToken) {
        results.push({ accountId: actId, error: 'No valid token' });
        continue;
      }
      for (let i = 0; i < ruleChunks.length; i++) {
        const chunk = ruleChunks[i];
        const audienceName = ruleChunks.length > 1 ? `${baseName} - ${i + 1}` : baseName;
        const rule = { inclusions: { operator: 'or', rules: chunk } };
        const formData = new FormData();
        formData.append('name', audienceName);
        formData.append('rule', JSON.stringify(rule));
        formData.append('prefill', '1');
        formData.append('access_token', accessToken);
        const res = await fetch(`https://graph.facebook.com/v22.0/${actId}/customaudiences`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) {
          const msg = data.error.error_user_msg || data.error.message;
          const errMsg = msg.includes('page_messaged') || msg.includes('Europe')
            ? 'page_messaged อาจไม่รองรับในภูมิภาคของคุณ ลองใช้ page_engaged แทน'
            : msg;
          results.push({ accountId: actId, error: errMsg });
        } else {
          results.push({ accountId: actId, id: data.id });
        }
      }
    }

    const success = results.filter((r) => r.id);
    return NextResponse.json({
      results,
      audience: success[0] ? { id: success[0].id } : null,
      created: success.length,
      failed: results.length - success.length,
    });
  } catch (e: any) {
    console.error('Custom audiences POST error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
