'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    AUTO_RULES_PAUSE: 'Auto Rules หยุดแคมเปญ',
    API_ERROR: 'API Error',
};

function getActionLabel(action: string): string {
    return ACTION_LABELS[action] || action;
}

interface LogsFilterBarProps {
    actions: string[];
    users: { id: string; name: string | null; email: string | null }[];
    currentAction?: string;
    currentUserId?: string;
    page: number;
    totalPages: number;
    totalCount: number;
}

export function LogsFilterBar({
    actions,
    users,
    currentAction,
    currentUserId,
    page,
    totalPages,
    totalCount,
}: LogsFilterBarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    function updateParams(updates: Record<string, string | undefined>) {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value) params.set(key, value);
            else params.delete(key);
        });
        params.set('page', '1'); // Reset to page 1 when filter changes
        router.push(`/admin/logs?${params.toString()}`);
    }

    function goToPage(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(p));
        router.push(`/admin/logs?${params.toString()}`);
    }

    return (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">การกระทำ:</span>
                <Select
                    value={currentAction || 'all'}
                    onValueChange={(v) => updateParams({ action: v === 'all' ? undefined : v })}
                >
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {actions.map((a) => (
                            <SelectItem key={a} value={a}>
                                {getActionLabel(a)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">ผู้ใช้:</span>
                <Select
                    value={currentUserId || 'all'}
                    onValueChange={(v) => updateParams({ userId: v === 'all' ? undefined : v })}
                >
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                                {u.name || u.email || u.id}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    {totalCount} รายการ
                </span>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToPage(page - 1)}
                            disabled={page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">
                            {page} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToPage(page + 1)}
                            disabled={page >= totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
