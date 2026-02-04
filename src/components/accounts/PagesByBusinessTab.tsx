'use client';

import { useConfig } from '@/contexts/AdAccountContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, RefreshCw } from 'lucide-react';

export function PagesByBusinessTab() {
    const { businessPages, businesses, refreshData, loading } = useConfig();

    const pagesByBusiness = businessPages.reduce((acc, page) => {
        const businessName = page.business_name || 'Unknown Business';
        if (!acc[businessName]) acc[businessName] = [];
        acc[businessName].push(page);
        return acc;
    }, {} as Record<string, typeof businessPages>);

    const businessGroups = Object.entries(pagesByBusiness)
        .sort(([a], [b]) => a.localeCompare(b));

    return (
        <div className="space-y-3 max-w-2xl">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    Pages grouped by Business Portfolio
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
            ) : businessPages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center border rounded-md bg-card">
                    <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                        No pages found
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {businessGroups.map(([businessName, pages]) => {
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
                                        {pages.length} page{pages.length !== 1 ? 's' : ''}
                                    </Badge>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm table-fixed">
                                        <thead>
                                            <tr className="border-b bg-card">
                                                <th className="text-left px-3 py-2 font-medium w-auto min-w-0">Page</th>
                                                <th className="text-center px-3 py-2 font-medium w-28">Access</th>
                                                <th className="text-center px-3 py-2 font-medium w-28">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pages.map((page) => {
                                                const hasAccess = !!page.access_token;
                                                const status = page.is_published === true ? 'Published' :
                                                    page.is_published === false ? 'Unpublished' : 'N/A';
                                                const statusColor = status === 'Published' ? 'bg-green-500' :
                                                    status === 'Unpublished' ? 'bg-yellow-500' : 'bg-gray-500';
                                                return (
                                                    <tr key={page.id} className="border-b hover:bg-accent/50 transition-colors">
                                                        <td className="px-3 py-2 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                    {page.picture?.data?.url ? (
                                                                        <img src={page.picture.data.url} alt={page.name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0 truncate">
                                                                    <p className="font-medium truncate">{page.name}</p>
                                                                    <p className="text-xs text-muted-foreground truncate">ID: {page.id}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 w-28 text-center align-middle">
                                                            <Badge variant={hasAccess ? 'default' : 'outline'} className="text-xs">
                                                                {hasAccess ? 'Access' : 'No Access'}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2 w-28 text-center align-middle">
                                                            {page.is_published != null ? (
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
                    })}
                </div>
            )}
        </div>
    );
}
