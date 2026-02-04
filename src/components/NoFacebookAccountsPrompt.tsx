'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Facebook, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function NoFacebookAccountsPrompt() {
    const router = useRouter();

    const handleGoToTeam = () => {
        router.push('/settings?section=team');
    };

    return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
            <Card className="p-12 max-w-md">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <Facebook className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold">No Facebook Accounts Connected</h3>
                        <p className="text-muted-foreground">
                            Please connect a Facebook account to your team to access ad campaigns and manage your ads
                        </p>
                    </div>
                    <Button
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 text-white mt-4"
                        onClick={handleGoToTeam}
                    >
                        <Users className="h-5 w-5 mr-2" />
                        Go to Team Settings
                    </Button>
                </div>
            </Card>
        </div>
    );
}
