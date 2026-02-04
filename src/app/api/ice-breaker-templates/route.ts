import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const list = await prisma.iceBreakerTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      templates: list.map((t) => ({
        id: t.id,
        name: t.name,
        items: t.items as { question: string; payload: string }[],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (e) {
    console.error('[ice-breaker-templates] GET error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, items } = body as { name: string; items: { question: string; payload: string }[] };

    if (!name || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing name or items (array of { question, payload })' },
        { status: 400 }
      );
    }

    await prisma.iceBreakerTemplate.create({
      data: {
        userId: session.user.id,
        name: String(name).trim(),
        items: items.slice(0, 4) as object,
      },
    });

    // Return full list to avoid client refetch
    const list = await prisma.iceBreakerTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      templates: list.map((t) => ({
        id: t.id,
        name: t.name,
        items: t.items as { question: string; payload: string }[],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (e) {
    console.error('[ice-breaker-templates] POST error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create template' },
      { status: 500 }
    );
  }
}
