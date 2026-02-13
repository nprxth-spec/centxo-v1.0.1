'use client';

/**
 * Meta Connection Settings Page - Redirects to Settings
 * 
 * Note: Meta Connection functionality has been moved to /settings?tab=team
 * This page redirects to maintain backward compatibility with OAuth callbacks
 */

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MetaSettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Get success/error params from OAuth callback
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    // Redirect to Team & Connection tab in Settings
    // Preserve success/error params for display
    const params = new URLSearchParams();
    params.set('tab', 'team');
    if (success) params.set('metaSuccess', 'true');
    if (error) params.set('metaError', error);
    
    router.replace(`/settings?${params.toString()}`);
  }, [searchParams, router]);

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Settings...</p>
      </div>
    </div>
  );
}
