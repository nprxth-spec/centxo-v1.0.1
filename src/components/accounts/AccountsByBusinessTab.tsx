'use client';

import { useConfig } from '@/contexts/AdAccountContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Loader2, RefreshCw } from 'lucide-react';

export function AccountsByBusinessTab() {
    const { adAccounts, businessAccounts, businesses, refreshData, loading } = useConfig();

    return (
        <div className="space-y-3 max-w-2xl">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    Ad Accounts grouped by Business Portfolio
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshData(true)}
                    className="h-8"
                    disabled={loading}
                >
                    <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-32 text-center border rounded-md bg-card">
                    <Loader2 className="h-10 w-10 text-muted-foreground mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground">
                        Loading...
                    </p>
                </div>
            ) : businesses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center border rounded-md bg-card">
                    <Briefcase className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                        No business portfolios found
                    </p>
                </div>
            ) : businessAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center border rounded-md bg-card">
                    <Briefcase className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                        No ad accounts found in business portfolios
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {(() => {
                        const accountsByBusiness = businessAccounts.reduce((acc, account) => {
                            const businessName = account.business_name || 'Unknown Business';
                            if (!acc[businessName]) acc[businessName] = [];
                            acc[businessName].push(account);
                            return acc;
                        }, {} as Record<string, typeof businessAccounts>);

                        const businessGroups = Object.entries(accountsByBusiness)
                            .sort(([a], [b]) => a.localeCompare(b));

                        return businessGroups.map(([businessName, accounts]) => {
                            const matchingBusiness = businesses.find(b => b.name === businessName);
                            return (
                                <div key={businessName} className="border rounded-md overflow-hidden bg-card">
                                    <div className="bg-card px-3 py-2 flex items-center justify-between border-b">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {matchingBusiness?.profile_picture_uri ? (
                                                <img
                                                    src={matchingBusiness.profile_picture_uri}
                                                    alt={businessName}
                                                    className="w-6 h-6 rounded-full border flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                                                    {businessName.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0 truncate">
                                                <h3 className="font-medium truncate">{businessName}</h3>
                                                {matchingBusiness && (
                                                    <p className="text-xs text-muted-foreground truncate">{matchingBusiness.id}</p>
                                                )}
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="flex-shrink-0">
                                            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                                        </Badge>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm table-fixed">
                                            <thead>
                                                <tr className="border-b bg-card">
                                                    <th className="text-left px-3 py-2 font-medium w-auto min-w-0">Account</th>
                                                    <th className="text-center px-3 py-2 font-medium w-28">Access</th>
                                                    <th className="text-center px-3 py-2 font-medium w-28">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {accounts.map((account) => {
                                                    const hasAccess = adAccounts.some(a => a.id === account.id);
                                                    const statusRaw = account.account_status === 1 ? 'ACTIVE' :
                                                        account.account_status === 2 ? 'DISABLED' :
                                                            account.account_status === 3 ? 'UNSETTLED' :
                                                                account.account_status === 7 ? 'PENDING_RISK_REVIEW' :
                                                                    account.account_status === 8 ? 'PENDING_SETTLEMENT' :
                                                                        account.account_status === 9 ? 'IN_GRACE_PERIOD' :
                                                                            account.account_status === 100 ? 'PENDING_CLOSURE' :
                                                                                account.account_status === 101 ? 'CLOSED' : 'N/A';
                                                    const status = statusRaw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                                                    const statusColor = statusRaw === 'ACTIVE' ? 'bg-green-500' :
                                                        statusRaw === 'DISABLED' || statusRaw === 'CLOSED' ? 'bg-red-500' :
                                                            ['UNSETTLED', 'PENDING_RISK_REVIEW', 'PENDING_SETTLEMENT', 'IN_GRACE_PERIOD', 'PENDING_CLOSURE'].includes(statusRaw) ? 'bg-yellow-500' : 'bg-gray-500';
                                                    return (
                                                        <tr key={account.id} className="border-b hover:bg-accent/50 transition-colors">
                                                            <td className="px-3 py-2 min-w-0">
                                                                <p className="font-medium truncate">{account.name}</p>
                                                                <p className="text-xs text-muted-foreground truncate">ID: {account.account_id}</p>
                                                            </td>
                                                            <td className="px-3 py-2 w-28 text-center align-middle">
                                                                <Badge variant={hasAccess ? 'default' : 'outline'} className="text-xs">
                                                                    {hasAccess ? 'Access' : 'No Access'}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-3 py-2 w-28 text-center align-middle">
                                                                {account.account_status != null ? (
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
                                                                        <span>{status}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted-foreground">—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            )}
        </div>
    );
}
