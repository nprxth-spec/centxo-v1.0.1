/**
 * POST /api/cron/export
 * Runs auto-export for ExportConfigs with autoExportEnabled = true.
 * Call from cron-job.org or similar (e.g. daily or hourly).
 * Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.exportConfig.findMany({
      where: { autoExportEnabled: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (configs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No auto-export configs enabled',
        triggered: 0,
        results: [],
      });
    }

    const base = process.env.NEXTAUTH_URL ||
      (typeof process.env.VERCEL_URL === 'string' ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:3000';
    const results: { configId: string; success: boolean; error?: string; count?: number }[] = [];

    for (const c of configs) {
      try {
        const res = await fetch(`${base}/api/export/google-sheets/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configId: c.id,
            cronSecret: process.env.CRON_SECRET,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          results.push({ configId: c.id, success: true, count: (data as any).count });
        } else {
          const err = (data as any).error || `HTTP ${res.status}`;
          results.push({ configId: c.id, success: false, error: err });
          await prisma.exportConfig.update({
            where: { id: c.id },
            data: { lastExportAt: new Date(), lastExportStatus: 'FAILED', lastExportError: err },
          });
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Unknown error';
        results.push({ configId: c.id, success: false, error: err });
        await prisma.exportConfig.update({
          where: { id: c.id },
          data: { lastExportAt: new Date(), lastExportStatus: 'FAILED', lastExportError: err },
        });
      }
    }

    return NextResponse.json({
      success: true,
      triggered: configs.length,
      results,
    });
  } catch (error) {
    console.error('[CRON] Export job failed:', error);
    return NextResponse.json(
      { error: 'Export job failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const count = await prisma.exportConfig.count({
      where: { autoExportEnabled: true },
    });

    return NextResponse.json({
      status: 'ok',
      autoExportConfigs: count,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
