import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const METRICS = ['spend', 'messages', 'impressions', 'reach', 'clicks', 'costPerMessage'] as const;
const OPS = ['gt', 'gte', 'lt', 'lte', 'eq'] as const;

function parseBody<T>(body: unknown): T | null {
  if (body == null || typeof body !== 'object') return null;
  return body as T;
}

function validateCondition(c: unknown): { metric: string; op: string; value: number } | null {
  const o = parseBody<{ metric?: string; op?: string; value?: number }>(c);
  if (!o || typeof o.metric !== 'string' || typeof o.op !== 'string' || typeof o.value !== 'number') return null;
  if (!METRICS.includes(o.metric as any) || !OPS.includes(o.op as any)) return null;
  if (!Number.isFinite(o.value)) return null;
  return { metric: o.metric, op: o.op, value: o.value };
}

function validateAction(a: unknown): { type: 'pause' } | null {
  const o = parseBody<{ type?: string }>(a);
  if (!o || o.type !== 'pause') return null;
  return { type: 'pause' };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id ?? (session.user as any).sub;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Session missing user id' }, { status: 401 });
  }

  const rl = await rateLimit(request, RateLimitPresets.standard, userId);
  if (rl) return rl;

  if (typeof (prisma as any).automationRule === 'undefined') {
    return NextResponse.json(
      { error: 'Auto Rules not set up', details: 'Run: npx prisma migrate dev --name add_automation_rules, then npx prisma generate. On PowerShell, run each command separately.' },
      { status: 503 }
    );
  }

  try {
    const list = await (prisma as any).automationRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ rules: list });
  } catch (e) {
    console.error('[automation/rules] GET error:', e);
    return NextResponse.json({ error: 'Failed to list rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id ?? (session.user as any).sub;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Session missing user id' }, { status: 401 });
  }

  const rl = await rateLimit(request, RateLimitPresets.strict, userId);
  if (rl) return rl;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const o = parseBody<{
    name?: string;
    enabled?: boolean;
    scope?: string;
    adAccountIds?: string[];
    condition?: unknown;
    action?: unknown;
  }>(body);

  if (!o?.name || typeof o.name !== 'string' || !o.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const scope = (o.scope === 'campaign' || o.scope === 'adset' || o.scope === 'ad') ? o.scope : 'campaign';
  const condition = validateCondition(o.condition);
  const action = validateAction(o.action);
  if (!condition || !action) {
    return NextResponse.json({ error: 'Invalid condition or action' }, { status: 400 });
  }

  const adAccountIds = Array.isArray(o.adAccountIds)
    ? o.adAccountIds.filter((x): x is string => typeof x === 'string')
    : [];

  if (typeof (prisma as any).automationRule === 'undefined') {
    return NextResponse.json({
      error: 'Failed to create rule',
      details: 'Run: npx prisma migrate dev --name add_automation_rules, then npx prisma generate. On PowerShell, run each command separately.',
    }, { status: 503 });
  }

  try {
    const rule = await (prisma as any).automationRule.create({
      data: {
        userId,
        name: o.name.trim(),
        enabled: o.enabled !== false,
        scope,
        adAccountIds: JSON.stringify(adAccountIds),
        condition: condition as object,
        action: action as object,
      },
    });
    return NextResponse.json(rule);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error('[automation/rules] POST error:', e);
    const hint = /migrate|generate|doesn't exist|unknown.*automation|Table.*automation/i.test(msg)
      ? ' Run: npx prisma migrate dev --name add_automation_rules, then npx prisma generate. On PowerShell, run each command separately.'
      : '';
    return NextResponse.json({
      error: 'Failed to create rule',
      details: msg + hint,
    }, { status: 500 });
  }
}
