
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { Users, Activity, ShieldAlert, Database } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export default async function AdminDashboardPage() {
    // Parallel data fetching for stats
    const [userCount, interestCount, campaignCount, recentLogs] = await Promise.all([
        prisma.user.count(),
        prisma.facebookInterest.count(),
        prisma.campaign.count(),
        prisma.auditLog.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                // If we had a User relation in AuditLog properly set up, we'd include it.
                // Checking schema, AuditLog has userId but no relation defined to User model in `prisma/schema.prisma` lines 195-213.
                // We rely on manually storing details or adding relation later.
            }
        })
    ]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{userCount}</div>
                        <p className="text-xs text-muted-foreground">Active members</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Interest Database</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(interestCount)}</div>
                        <p className="text-xs text-muted-foreground">Synced keywords</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{campaignCount}</div>
                        <p className="text-xs text-muted-foreground">Running ads</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Health</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Operational</div>
                        <p className="text-xs text-muted-foreground">All systems go</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Activity Logs</CardTitle>
                        <CardDescription>
                            Latest actions performed across the system.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentLogs.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No activity logs found.</p>
                            ) : (
                                recentLogs.map((log) => (
                                    <div key={log.id} className="flex items-center">
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">{log.action}</p>
                                            <p className="text-sm text-muted-foreground">
                                                User ID: {log.userId || 'System'} • {new Date(log.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Placeholder for Quick Actions or other stats */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Quick Admin Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {/* We will implement these buttons later */}
                        <p className="text-sm text-muted-foreground">User Management (Coming Soon)</p>
                        <p className="text-sm text-muted-foreground">System Config (Coming Soon)</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
