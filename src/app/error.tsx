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
            <div className="p-4 bg-red-50 text-red-900 rounded-full">
                <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Something went wrong!</h2>
            <p className="text-gray-600 max-w-md text-center">
                {error.message || "An unexpected error occurred. Please try again."}
            </p>
            <Button onClick={() => reset()} className="bg-blue-600 hover:bg-blue-700">
                Try again
            </Button>
        </div>
    );
}
