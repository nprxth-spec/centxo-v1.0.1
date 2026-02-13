import { prisma } from '@/lib/prisma';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { LogsFilterBar } from './LogsFilterBar';

const PAGE_SIZE = 100;
const ACTION_LABELS: Record<string, string> = {
    LOGIN_GOOGLE: 'ล็อกอิน (Google)',
    LOGIN_PASSWORD: 'ล็อกอิน (รหัสผ่าน)',
    LOGIN_ADMIN: 'ล็อกอิน (Admin)',
    LOGIN_FACEBOOK: 'ล็อกอิน (Facebook)',
    USER_REGISTER: 'สมัครสมาชิก',
    PASSWORD_CHANGE: 'เปลี่ยนรหัสผ่าน',
    PASSWORD_ADD: 'เพิ่มรหัสผ่าน',
    CREATE_CAMPAIGN: 'สร้างแคมเปญ',
    CREATE_CAMPAIGN_MULTI: 'สร้างแคมเปญ (หลายสื่อ)',
    BOOST_POST: 'โปรโมทโพสต์',
    EXPORT_GOOGLE_SHEET: 'ส่งออก Google Sheet',
    EXPORT_GOOGLE_SHEET_TRIGGER: 'ส่งออก Google Sheet (Trigger)',
    ADD_EXPORT_CONFIG: 'เพิ่มการตั้งค่าส่งออก',
    UPDATE_EXPORT_CONFIG: 'แก้ไขการตั้งค่าส่งออก',
    DELETE_EXPORT_CONFIG: 'ลบการตั้งค่าส่งออก',
    UPDATE_USER_PROFILE: 'แก้ไขโปรไฟล์',
    META_CONNECT: 'เชื่อมต่อ Meta/Facebook',
    TEAM_ADD_MEMBER: 'เพิ่มสมาชิกทีม',
    DISCONNECT_ACCOUNT: 'ยกเลิกการเชื่อมต่อบัญชี',
    USER_DELETE: 'ลบบัญชี',
    LAUNCH_VIDEO: 'Launch วิดีโอ',
    SYNC_INTERESTS: 'ซิงค์ Interests',
    DATA_DELETION_REQUEST: 'คำขอลบข้อมูล',
    UPDATE_CAMPAIGN: 'แก้ไขแคมเปญ',
    PAUSE_CAMPAIGN: 'หยุดแคมเปญ',
    RESUME_CAMPAIGN: 'เปิดแคมเปญ',
    UPDATE_AD: 'แก้ไขโฆษณา',
    PAUSE_AD: 'หยุดโฆษณา',
    RESUME_AD: 'เปิดโฆษณา',
    API_ERROR: 'API Error',
};

function getActionLabel(action: string): string {
    return ACTION_LABELS[action] || action;
}

export default async function AdminLogsPage({
    searchParams,
}: {
    searchParams: Promise<{ action?: string; userId?: string; page?: string }>;
}) {
    const params = await searchParams;
    const actionFilter = params.action || undefined;
    const userIdFilter = params.userId || undefined;
    const page = Math.max(1, parseInt(params.page || '1', 10));

    const where: Record<string, unknown> = {};
    if (actionFilter) where.action = actionFilter;
    if (userIdFilter) where.userId = userIdFilter;

    const [logs, totalCount, distinctActions, usersForFilter] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
            select: { action: true },
            distinct: ['action'],
            orderBy: { action: 'asc' },
        }),
        prisma.user.findMany({
            select: { id: true, name: true, email: true },
            orderBy: { email: 'asc' },
        }),
    ]);

    const userIds = [...new Set(logs.map(log => log.userId).filter(Boolean) as string[])];
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
    });

    const userMap = users.reduce((acc, user) => {
        acc[user.id] = user.name || user.email || 'Unknown';
        return acc;
    }, {} as Record<string, string>);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
            </div>

            <LogsFilterBar
                actions={distinctActions.map(a => a.action)}
                users={usersForFilter}
                currentAction={actionFilter}
                currentUserId={userIdFilter}
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
            />

            <Card>
                <CardHeader>
                    <CardTitle>System Audit Logs</CardTitle>
                    <CardDescription>
                        บันทึกการกระทำของทุกผู้ใช้ — ล็อกอิน, สร้างแคมเปญ, ส่งออก Google Sheet และอื่นๆ
                        {totalCount > 0 && ` (แสดง ${logs.length} จาก ${totalCount} รายการ)`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">เวลา</TableHead>
                                <TableHead className="w-[180px]">ผู้ใช้</TableHead>
                                <TableHead className="w-[200px]">การกระทำ</TableHead>
                                <TableHead>รายละเอียด</TableHead>
                                <TableHead className="w-[120px]">IP</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        ไม่พบล็อก
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-muted-foreground font-mono text-xs">
                                            {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {log.userId ? userMap[log.userId] || log.userId : 'System'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" title={log.action}>
                                                {getActionLabel(log.action)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[400px] truncate text-xs text-muted-foreground" title={log.details ? JSON.stringify(log.details) : ''}>
                                            {log.details ? (
                                                <span className="font-mono">{JSON.stringify(log.details)}</span>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground font-mono">
                                            {log.ipAddress || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
