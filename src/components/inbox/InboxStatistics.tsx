'use client';

import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Calendar as CalendarIcon, MessageCircle, Loader2, ChevronDown, Users, Clock } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type StatsMode = 'byTime' | 'byUser';

interface ByUserItem {
  userId: string;
  userName: string;
  customerCount: number;
  messageCount: number;
}

interface InboxStatisticsProps {
  pageIds: string[];
  pageNames: string[];
  selectionMode: 'single' | 'multi';
}

export function InboxStatistics({ pageIds, pageNames, selectionMode }: InboxStatisticsProps) {
  const { language } = useLanguage();
  const [mode, setMode] = useState<StatsMode>('byTime');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeData, setTimeData] = useState<{
    total: number;
    hourlyData: { hour: number; count: number; label: string }[];
  } | null>(null);
  const [userData, setUserData] = useState<ByUserItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tz =
    (typeof window !== 'undefined' ? localStorage.getItem('user_timezone') : null) ||
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat?.().resolvedOptions?.()?.timeZone) ||
    'Asia/Bangkok';

  useEffect(() => {
    if (pageIds.length === 0) {
      setTimeData(null);
      setUserData(null);
      return;
    }
    setLoading(true);
    setError(null);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const d = selectedDate.getDate();
    const start = new Date(y, m, d, 0, 0, 0, 0);
    const end = new Date(y, m, d, 23, 59, 59, 999);
    const params = new URLSearchParams({
      pageIds: pageIds.join(','),
      date: dateStr,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: tz,
    });
    if (mode === 'byUser') params.set('mode', 'byUser');
    const url = `/api/inbox/statistics?${params.toString()}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => {
        if (mode === 'byUser') {
          setUserData(json.byUser || []);
          setTimeData(null);
        } else {
          setTimeData({
            total: json.total,
            hourlyData: json.hourlyData || [],
          });
          setUserData(null);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load statistics');
        setTimeData(null);
        setUserData(null);
      })
      .finally(() => setLoading(false));
  }, [pageIds.join(','), selectedDate.toISOString().slice(0, 10), mode, tz]);

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isYesterday =
    format(selectedDate, 'yyyy-MM-dd') === format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const dateLabel = isToday
    ? language === 'th' ? 'วันนี้' : 'Today'
    : isYesterday
      ? language === 'th' ? 'เมื่อวาน' : 'Yesterday'
      : format(selectedDate, 'dd MMM yyyy');

  const peakHour =
    timeData?.hourlyData?.reduce(
      (a, b) => (b.count > a.count ? b : a),
      { hour: 0, count: 0 }
    );

  return (
    <div className="flex flex-col h-full overflow-hidden px-6 py-4 md:px-12 md:py-6 lg:px-20 lg:py-8">
      {/* Header + Tabs + Date selector */}
      <div className="shrink-0 flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              {language === 'th' ? 'สถิติการโต้ตอบอย่างละเอียด' : 'Detailed Interaction Statistics'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'th' ? 'สถิติรายละเอียดของการจับคู่ติดต่อตามเวลาและโดยพนักงาน' : 'Detailed statistics of contact matching by time and by employee'}
              {selectionMode === 'single' && pageNames[0] && (
                <span className="text-muted-foreground/80"> · {pageNames[0]}</span>
              )}
              {selectionMode === 'multi' && pageNames.length > 0 && (
                <span className="text-muted-foreground/80">
                  {' '}
                  · {language === 'th' ? `รวม ${pageNames.length} เพจ` : `Combined ${pageNames.length} pages`}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isToday ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              {language === 'th' ? 'วันนี้' : 'Today'}
            </Button>
            <Button
              variant={isYesterday ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedDate(subDays(new Date(), 1))}
            >
              {language === 'th' ? 'เมื่อวาน' : 'Yesterday'}
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'font-normal border-border/80 hover:bg-muted/50',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {selectedDate ? dateLabel : 'Pick date'}
                  <ChevronDown className="h-4 w-4 opacity-50 ml-1 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(d);
                      setCalendarOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Tabs: ตามเวลา / ตามผู้ใช้ */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setMode('byTime')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              mode === 'byTime'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Clock className="inline h-4 w-4 mr-2 align-middle" />
            {language === 'th' ? 'ตามเวลา' : 'By Time'}
          </button>
          <button
            type="button"
            onClick={() => setMode('byUser')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              mode === 'byUser'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="inline h-4 w-4 mr-2 align-middle" />
            {language === 'th' ? 'ตามผู้ใช้' : 'By User'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center min-h-[200px] text-destructive text-sm rounded-lg border border-destructive/20 bg-destructive/5">
          {error}
        </div>
      ) : !timeData && !userData ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-muted-foreground">
          <MessageCircle className="h-16 w-16 opacity-30 mb-4" />
          <p className="text-sm">
            {language === 'th' ? 'เลือกเพจเพื่อดูสถิติ' : 'Select pages to view statistics'}
          </p>
        </div>
      ) : mode === 'byUser' ? (
        /* By User view */
        <div className="flex-1 overflow-auto">
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">
                      {language === 'th' ? 'ผู้ใช้' : 'User'}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground">
                      {language === 'th' ? 'ลูกค้า' : 'Customers'}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground">
                      {language === 'th' ? 'ข้อความ' : 'Messages'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userData && userData.length > 0 ? (
                    userData.map((u, i) => (
                      <tr
                        key={u.userId}
                        className={cn(
                          'border-b border-border/50',
                          i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{u.userName}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          {u.customerCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {u.messageCount}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        {language === 'th'
                          ? 'ไม่มีข้อมูลในวันที่เลือก — เปิดการสนทนากับลูกค้าเพื่อบันทึกสถิติ'
                          : 'No data for selected date — open conversations to record stats'}
                      </td>
                    </tr>
                  )}
                </tbody>
                {userData && userData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                      <td className="px-4 py-3 text-foreground">
                        {language === 'th' ? 'รวม' : 'Total'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {userData.reduce((s, u) => s + u.customerCount, 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {userData.reduce((s, u) => s + u.messageCount, 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 px-1">
            {language === 'th'
              ? 'ลูกค้า = จำนวนบทสนทนาที่ผู้ใช้เปิดดูในวันที่เลือก · ข้อความ = ข้อความจากลูกค้าในบทสนทนานั้น'
              : 'Customers = conversations the user viewed on selected date · Messages = customer messages in those conversations'}
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards - By Time */}
          <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{timeData?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'th' ? 'ข้อความถึงเพจ' : 'Messages to page'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {peakHour && peakHour.count > 0
                      ? `${peakHour.hour.toString().padStart(2, '0')}:00`
                      : '–'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {peakHour && peakHour.count > 0
                      ? `${peakHour.count} ${language === 'th' ? 'ข้อความ' : 'msgs'}`
                      : '–'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'th' ? 'ช่วงเวลาที่มีผู้ติดต่อมากที่สุด' : 'Peak hour'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10">
                  <CalendarIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'th' ? 'วันที่เลือก' : 'Selected date'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Area chart */}
          <div className="flex-1 min-h-[280px] rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timeData?.hourlyData ?? []}
                margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  formatter={(value: number) => [
                    `${value} ${language === 'th' ? 'ข้อความ' : 'messages'}`,
                    '',
                  ]}
                  labelFormatter={(label) =>
                    `${label} - ${label.replace(':00', ':59')} ${language === 'th' ? 'น.' : 'hr'}`
                  }
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#msgGradient)"
                  name={language === 'th' ? 'จำนวนข้อความ' : 'Message count'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 px-1">
            {language === 'th'
              ? 'กราฟแสดงจำนวนข้อความที่ลูกค้าส่งเข้ามาในแต่ละช่วงเวลา (00:00–23:59)'
              : 'Chart shows customer messages received per hour (00:00–23:59)'}
          </p>
        </>
      )}
    </div>
  );
}
