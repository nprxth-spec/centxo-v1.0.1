'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

export default function SettingsIntegrationsPage() {
    const { t } = useLanguage();
    const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);

    useEffect(() => {
        fetchConnectedAccounts();
    }, []);

    const fetchConnectedAccounts = async () => {
        setLoadingAccounts(true);
        try {
            const response = await fetch('/api/auth/accounts');
            if (response.ok) {
                const data = await response.json();
                setConnectedAccounts(data.accounts || []);
            }
        } catch (error) {
            console.error('Error fetching connected accounts:', error);
        } finally {
            setLoadingAccounts(false);
        }
    };

    const handleDisconnect = async (provider: string) => {
        if (!confirm(`Are you sure you want to disconnect your ${provider} account?`)) {
            return;
        }

        try {
            const response = await fetch('/api/auth/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
            });

            if (response.ok) {
                fetchConnectedAccounts();
            }
        } catch (error) {
            console.error('Error disconnecting account:', error);
        }
    };

    const handleConnectProvider = async (provider: 'google' | 'facebook') => {
        await signIn(provider, {
            callbackUrl: '/settings/integrations',
            redirect: true,
        });
    };

    const connectedProviders = connectedAccounts.map(acc => acc.provider);
    const availableProviders = [
        {
            id: 'google',
            name: 'Google',
            connected: connectedProviders.includes('google'),
        },
        {
            id: 'facebook',
            name: 'Meta Business',
            connected: connectedProviders.includes('facebook'),
        },
    ];

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-foreground mb-2">{t('settings.integrations', 'Integrations')}</h1>
                <p className="text-muted-foreground">{t('settings.integrationsSubtitle', 'Manage your connected services and accounts')}</p>
            </div>

            <div className="glass-card p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Connected Accounts</h2>

                {loadingAccounts ? (
                    <div className="text-center py-8 text-gray-600">Loading...</div>
                ) : (
                    <div className="space-y-4">
                        {availableProviders.map((provider) => {
                            const connectedAccount = connectedAccounts.find(acc => acc.provider === provider.id);

                            return (
                                <div key={provider.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-3">
                                        {provider.id === 'facebook' && (
                                            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 2.848-5.978 5.817-5.978.33 0 3.165.178 3.165.178v3.39H16.27c-2.095 0-2.625 1.106-2.625 2.03v1.96h3.848l-.519 3.667h-3.329v7.98h-4.544z" />
                                                </svg>
                                            </div>
                                        )}
                                        {provider.id === 'google' && (
                                            <div className="w-10 h-10 bg-white border border-gray-300 rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                </svg>
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                                            {provider.connected && connectedAccount ? (
                                                <p className="text-sm text-gray-600">
                                                    Connected as {connectedAccount.email || 'User'}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-500">Not connected</p>
                                            )}
                                        </div>
                                    </div>

                                    {provider.connected ? (
                                        <Button
                                            variant="outline"
                                            className="text-red-600 border-red-300 hover:bg-red-50"
                                            onClick={() => handleDisconnect(provider.id)}
                                        >
                                            Disconnect
                                        </Button>
                                    ) : (
                                        <Button
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={() => handleConnectProvider(provider.id as 'google' | 'facebook')}
                                        >
                                            Connect
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
