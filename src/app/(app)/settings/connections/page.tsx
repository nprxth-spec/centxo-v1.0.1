'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Connections Settings Page - Redirects to Settings
 * 
 * Note: The "Connections" tab (for managing Facebook team member accounts) has been removed
 * to comply with Meta Account Integrity Policy. Users should connect their own Facebook
 * account via Settings instead.
 */
export default function ConnectionsSettingsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    
    useEffect(() => {
        const tab = searchParams.get('tab');
        
        // Redirect to settings page with team tab
        if (tab === 'team' || !tab) {
            router.replace('/settings?tab=team');
        } else {
            // For other tabs, redirect to settings page
            router.replace(`/settings?tab=${tab}`);
        }
    }, [searchParams, router]);
    
    // Show loading while redirecting
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <p className="text-muted-foreground">Redirecting...</p>
            </div>
        </div>
    );
}
