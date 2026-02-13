import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { prisma } from '@/lib/prisma';
import { buildTokensForUser } from '@/lib/automation/tokens';
import { createAuditLog, getRequestMetadata } from '@/lib/audit';
import {
  fetchCampaignsForRunner,
  evaluateCondition,
  pauseCampaign,
  type CampaignRow,
} from '@/lib/automation/runner';
import { getValidTokenForAdAccount } from '@/lib/facebook/token-helper';

export const dynamic = 'force-dynamic';

type Condition = { metric: string; op: string; value: number };
type Action = { type: 'pause' };

function getModel() {
  const m = (prisma as any).automationRule;
  return typeof m === 'undefined' ? null : m;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id ?? (session.user as any).sub;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Session missing user id' }, { status: 401 });
  }

  const rl = await rateLimit(request, RateLimitPresets.campaignCreate, userId);
  if (rl) return rl;

  if (!getModel()) {
    return NextResponse.json({
      error: 'Auto Rules unavailable',
      details: 'Run: npx prisma migrate dev --name add_automation_rules, then npx prisma generate. On PowerShell, run each command separately.',
    }, { status: 503 });
  }

  let body: { ruleIds?: string[]; adAccountIds: string[] } = { adAccountIds: [] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const adAccountIds = Array.isArray(body.adAccountIds)
    ? body.adAccountIds.filter((x): x is string => typeof x === 'string')
    : [];
  if (adAccountIds.length === 0) {
    return NextResponse.json({ error: 'adAccountIds is required and must be non-empty' }, { status: 400 });
  }

  const ruleIds = Array.isArray(body.ruleIds)
    ? body.ruleIds.filter((x): x is string => typeof x === 'string')
    : undefined;

  const tokens = await buildTokensForUser(session);
  if (tokens.length === 0) {
    return NextResponse.json({ error: 'No Facebook tokens found. Connect in Account → Team.' }, { status: 400 });
  }

  const rules = await getModel()!.findMany({
    where: {
      userId,
      enabled: true,
      ...(ruleIds && ruleIds.length ? { id: { in: ruleIds } } : {}),
    },
  });

  if (rules.length === 0) {
    return NextResponse.json({ ran: 0, paused: [], errors: ['No enabled rules to run'] });
  }

  const errors: string[] = [];
  const paused: { id: string; name: string }[] = [];

  let campaigns: CampaignRow[] = [];
  try {
    campaigns = await fetchCampaignsForRunner(adAccountIds, tokens);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Failed to fetch campaigns');
    return NextResponse.json({ ran: rules.length, paused: [], errors });
  }

  const activeCampaigns = campaigns.filter(
    (c) => (c.effectiveStatus || c.status || '').toUpperCase() === 'ACTIVE'
  );

  for (const rule of rules) {
    const cond = rule.condition as Condition | null;
    const act = rule.action as Action | null;
    if (!cond || act?.type !== 'pause') continue;

    const ruleAccountIds: string[] = [];
    try {
      const raw = JSON.parse(rule.adAccountIds || '[]');
      if (Array.isArray(raw)) ruleAccountIds.push(...raw.filter((x: unknown) => typeof x === 'string'));
    } catch {
      /* use all */
    }

    const eligible =
      ruleAccountIds.length === 0
        ? activeCampaigns
        : activeCampaigns.filter((c) => ruleAccountIds.includes(c.adAccountId));

    let rulePaused = 0;
    const ruleErrors: string[] = [];

    for (const camp of eligible) {
      if (!evaluateCondition(cond, camp.metrics)) continue;

      const token = await getValidTokenForAdAccount(camp.adAccountId, tokens);
      if (!token) {
        ruleErrors.push(`No token for ${camp.adAccountId}`);
        errors.push(`No token for account ${camp.adAccountId}`);
        continue;
      }

      const ok = await pauseCampaign(camp.id, token);
      if (ok) {
        rulePaused++;
        paused.push({ id: camp.id, name: camp.name });
        const { ipAddress, userAgent } = getRequestMetadata(request);
        await createAuditLog({
          userId,
          action: 'AUTO_RULES_PAUSE',
          entityType: 'Campaign',
          entityId: camp.id,
          details: { ruleId: rule.id, ruleName: rule.name, campaignName: camp.name, metrics: camp.metrics },
          ipAddress,
          userAgent,
        });
      } else {
        ruleErrors.push(`Failed to pause ${camp.name}`);
        errors.push(`Failed to pause campaign ${camp.name} (${camp.id})`);
      }
    }

    const summary = rulePaused > 0
      ? `Paused ${rulePaused} campaign(s).`
      : ruleErrors.length > 0
        ? `0 paused. ${ruleErrors.length} error(s).`
        : 'No matching campaigns.';
    await getModel()!
      .update({
        where: { id: rule.id },
        data: { lastRunAt: new Date(), lastResult: summary },
      })
      .catch(() => {});
  }

  return NextResponse.json({
    ran: rules.length,
    paused,
    errors: errors.length ? errors : undefined,
  });
}
