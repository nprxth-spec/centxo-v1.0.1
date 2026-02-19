'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
            <div className="p-4 bg-destructive/10 text-destructive rounded-full">
                <AlertCircle className="w-12 h-12 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Something went wrong!</h2>
            <p className="text-muted-foreground max-w-md text-center">
                {error.message || "An unexpected error occurred. Please try again."}
            </p>
            <Button onClick={() => reset()} variant="default">
                Try again
            </Button>
        </div>
    );
}
