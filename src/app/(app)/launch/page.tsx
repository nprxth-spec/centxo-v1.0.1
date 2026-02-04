'use client';

import LaunchWizard from '@/components/launch-wizard';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function LaunchPage() {
  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quick Launch</h1>
        <p className="text-muted-foreground mt-1">
          สร้างแคมเปญ Message Ads แบบรวดเร็ว 4 ขั้นตอน
        </p>
        <Link href="/create-ads" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2">
          ต้องการตัวเลือกเพิ่มเติม? ไปที่ระบบสร้างแอดออโต้
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <LaunchWizard />
    </div>
  );
}
