'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirect legacy /ads?tab=accounts-vcid to /ads?tab=accounts */
export default function AccountsVcidRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/ads?tab=accounts');
    }, [router]);

    return (
        <div className="h-full p-4 md:p-6 lg:p-8 flex items-center justify-center">
            <div className="text-muted-foreground">Redirecting...</div>
        </div>
    );
}
