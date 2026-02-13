/**
 * GET /api/adbox/statistics
 * Returns message statistics by hour for given pageIds and date.
 * mode=byTime (default): hourlyData, total
 * mode=byUser: byUser array with per-user customer counts
 * สถิติต้องขึ้นตามเวลาที่ลูกค้าทักจริงๆ = message.createdAt
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** คำนวณ start/end ของวัน (ใน timezone) เป็น UTC = เวลาที่ลูกค้าทักจริงๆ */
function getDayRangeInUTC(dateParam: string, timezone: string): { start: Date; end: Date } {
  const [y, m, d] = dateParam.split('-').map(Number);
  if (!y || !m || !d) throw new Error('Invalid date');
  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const localHour = parseInt(
    new Intl.DateTimeFormat('en', { timeZone: timezone, hour: 'numeric', hour12: false }).format(utcMidnight),
    10
  );
  const start = new Date(utcMidnight.getTime() - localHour * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pageIdsParam = searchParams.get('pageIds');
    const dateParam = searchParams.get('date');
    const mode = searchParams.get('mode') || 'byTime';

    if (!pageIdsParam || !dateParam) {
      return NextResponse.json(
        { error: 'Missing pageIds or date' },
        { status: 400 }
      );
    }

    const pageIds = pageIdsParam.split(',').filter(Boolean);
    if (pageIds.length === 0) {
      return NextResponse.json({ error: 'No pageIds provided' }, { status: 400 });
    }

    const tz = searchParams.get('timezone') || 'Asia/Bangkok';
    let startOfDay: Date;
    let endOfDay: Date;
    try {
      const range = getDayRangeInUTC(dateParam, tz);
      startOfDay = range.start;
      endOfDay = range.end;
    } catch {
      const [y, m, d] = dateParam.split('-').map(Number);
      if (!y || !m || !d) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
      }
      startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    }

    if (mode === 'byUser') {
      // Per-user stats: conversations viewed by each user that had customer messages on this date
      const conversations = await prisma.conversation.findMany({
        where: {
          pageId: { in: pageIds },
          viewedBy: { not: null },
          messages: {
            some: {
              isFromPage: false,
              createdAt: { gte: startOfDay, lte: endOfDay },
            },
          },
        },
        select: {
          id: true,
          participantId: true,
          viewedBy: true,
          viewedByName: true,
          messages: {
            where: {
              isFromPage: false,
              createdAt: { gte: startOfDay, lte: endOfDay },
            },
            select: { id: true },
          },
        },
      });

      const byUserMap = new Map<
        string,
        { userId: string; userName: string; customerCount: number; messageCount: number }
      >();
      for (const c of conversations) {
        const uid = c.viewedBy!;
        const name = c.viewedByName || 'Unknown';
        const existing = byUserMap.get(uid);
        const msgCount = c.messages.length;
        if (existing) {
          existing.customerCount += 1;
          existing.messageCount += msgCount;
        } else {
          byUserMap.set(uid, {
            userId: uid,
            userName: name,
            customerCount: 1,
            messageCount: msgCount,
          });
        }
      }

      const byUser = Array.from(byUserMap.values()).sort(
        (a, b) => b.customerCount - a.customerCount
      );

      return NextResponse.json({
        date: dateParam,
        pageIds,
        mode: 'byUser',
        byUser,
      });
    }

    // byTime (default)
    const messages = await prisma.message.findMany({
      where: {
        isFromPage: false,
        createdAt: { gte: startOfDay, lte: endOfDay },
        conversation: { pageId: { in: pageIds } },
      },
      select: { createdAt: true },
    });

    // ชั่วโมงตาม timezone ผู้ใช้ = เวลาที่ลูกค้าทักจริงๆ ในท้องถิ่น
    const hourFormatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const hourCounts = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourCounts.set(h, 0);
    for (const m of messages) {
      const hour = parseInt(hourFormatter.format(m.createdAt), 10);
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }

    const hourlyData: { hour: number; count: number; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
      hourlyData.push({
        hour: h,
        count: hourCounts.get(h) ?? 0,
        label: `${h.toString().padStart(2, '0')}:00`,
      });
    }

    const total = messages.length;

    return NextResponse.json({
      date: dateParam,
      pageIds,
      total,
      hourlyData,
    });
  } catch (error) {
    console.error('Error fetching adbox statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
