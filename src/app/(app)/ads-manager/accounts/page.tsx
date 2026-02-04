'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdsManagerAccountsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/ads-manager/accounts-vcid');
    }, [router]);

    return (
        <div className="h-full p-4 md:p-6 lg:p-8 flex items-center justify-center">
            <div className="text-muted-foreground">Redirecting...</div>
        </div>
    );
}
