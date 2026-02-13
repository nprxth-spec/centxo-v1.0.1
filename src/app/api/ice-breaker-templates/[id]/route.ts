import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, items } = body as { name?: string; items?: { question: string; payload: string }[] };

    const existing = await prisma.iceBreakerTemplate.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const data: { name?: string; items?: object } = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (Array.isArray(items) && items.length > 0) data.items = items.slice(0, 4) as object;

    const template = await prisma.iceBreakerTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      template: {
        id: template.id,
        name: template.name,
        items: template.items as { question: string; payload: string }[],
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  } catch (e) {
    console.error('[ice-breaker-templates] PATCH error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.iceBreakerTemplate.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.iceBreakerTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[ice-breaker-templates] DELETE error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete template' },
      { status: 500 }
    );
  }
}
