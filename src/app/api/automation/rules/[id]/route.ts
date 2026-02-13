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

function getModel() {
  const m = (prisma as any).automationRule;
  return typeof m === 'undefined' ? null : m;
}

async function getRule(id: string, userId: string) {
  const model = getModel();
  if (!model) return null;
  return model.findFirst({ where: { id, userId } });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id ?? (session.user as any).sub;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Session missing user id' }, { status: 401 });
  }

  const rl = await rateLimit(_request, RateLimitPresets.standard, userId);
  if (rl) return rl;

  if (!getModel()) {
    return NextResponse.json({ error: 'Not found', details: 'Run: npx prisma migrate dev --name add_automation_rules, then npx prisma generate. On PowerShell, run each command separately.' }, { status: 503 });
  }

  const { id } = await params;
  const rule = await getRule(id, userId);
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rule);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id ?? (session.user as any).sub;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Session missing user id' }, { status: 401 });
  }

  const rl = await rateLimit(request, RateLimitPresets.strict, userId);
  if (rl) return rl;

  if (!getModel()) {
    return NextResponse.json({ error: 'Failed to update rule', details: 'Run: npx prisma migrate dev --name add_automation_rules, then npx prisma generate. On PowerShell, run each command separately.' }, { status: 503 });
  }

  const { id } = await params;
  const rule = await getRule(id, userId);
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

  const updates: Record<string, unknown> = {};
  if (typeof o?.name === 'string' && o.name.trim()) updates.name = o.name.trim();
  if (typeof o?.enabled === 'boolean') updates.enabled = o.enabled;
  if (o?.scope === 'campaign' || o?.scope === 'adset' || o?.scope === 'ad') updates.scope = o.scope;
  if (Array.isArray(o?.adAccountIds)) {
    updates.adAccountIds = JSON.stringify(o.adAccountIds.filter((x): x is string => typeof x === 'string'));
  }
  const cond = validateCondition(o?.condition);
  if (cond) updates.condition = cond;
  const act = validateAction(o?.action);
  if (act) updates.action = act;

  try {
    const updated = await getModel()!.update({
      where: { id },
      data: updates as any,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error('[automation/rules] PATCH error:', e);
    return NextResponse.json({ error: 'Failed to update rule', details: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id ?? (session.user as any).sub;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Session missing user id' }, { status: 401 });
  }

  const rl = await rateLimit(_request, RateLimitPresets.strict, userId);
  if (rl) return rl;

  if (!getModel()) {
    return NextResponse.json({ error: 'Failed to delete rule', details: 'Run: npx prisma migrate dev --name add_automation_rules, then npx prisma generate. On PowerShell, run each command separately.' }, { status: 503 });
  }

  const { id } = await params;
  const rule = await getRule(id, userId);
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    await getModel()!.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error('[automation/rules] DELETE error:', e);
    return NextResponse.json({ error: 'Failed to delete rule', details: msg }, { status: 500 });
  }
}
