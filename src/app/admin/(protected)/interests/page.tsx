
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Target, Search, Download, Facebook } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatNumber } from '@/lib/utils';
import { showCustomToast } from '@/utils/custom-toast';
import { Input } from "@/components/ui/input";

interface Interest {
    id: string;
    name: string;
    audienceSizeLowerBound: string;
    audienceSizeUpperBound: string;
    topic?: string;
    fbId: string;
}

export default function AdminInterestsPage() {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [hasConnection, setHasConnection] = useState(false);
    const [checkingConnection, setCheckingConnection] = useState(true);
    const [interests, setInterests] = useState<Interest[]>([]);
    const [stats, setStats] = useState({ total: 0, topics: 0 });

    const checkFacebookConnection = async () => {
        try {
            const res = await fetch('/api/team/members');
            if (res.ok) {
                const data = await res.json();
                setHasConnection(data.members && data.members.length > 0);
            }
        } catch (error) {
            console.error('Error checking connection:', error);
        } finally {
            setCheckingConnection(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // We can reuse the Super Target API but we might want a cleaner admin one later.
            // For now let's reuse but just get the raw list or maybe filtered.
            // Actually, the Super Target API returns "top20" and "topics". 
            // Let's stick to that structure for now or create a better one? 
            // Let's use the same endpoint but maybe client-side filtering since we don't have search API yet.
            const res = await fetch('/api/targeting/super-target');
            if (res.ok) {
                const data = await res.json();
                setInterests(data.top20 || []);
                // Approximate total count from topics (not perfect but okay for now)
                const totalCount = (data.topics || []).reduce((acc: number, t: any) => acc + t.count, 0);
                setStats({
                    total: totalCount,
                    topics: data.topics?.length || 0
                });
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkFacebookConnection();
        fetchData();
    }, []);

    const handleConnectFacebook = async () => {
        setConnecting(true);
        try {
            const response = await fetch('/api/team/add-member?returnTo=/admin/interests');
            if (response.ok) {
                const data = await response.json();
                // Redirect to Facebook OAuth
                window.location.href = data.authUrl;
            } else {
                throw new Error('Failed to initiate Facebook connection');
            }
        } catch (error: any) {
            console.error('Error connecting Facebook:', error);
            showCustomToast(`Failed to connect: ${error.message}`, { type: 'error' });
            setConnecting(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/facebook/interests/sync', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                showCustomToast(`Synced ${data.count || 0} interests successfully!`, { type: 'success' });
                fetchData();
            } else {
                const err = await res.json();
                throw new Error(err.details || err.error || 'Sync failed');
            }
        } catch (error: any) {
            console.error(error);
            showCustomToast(`Failed: ${error.message}`, { type: 'error' });
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Interests Database</h1>
                    <p className="text-muted-foreground">Manage and sync Facebook targeting interests.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={hasConnection ? "outline" : "default"}
                        onClick={handleConnectFacebook}
                        disabled={connecting || checkingConnection || hasConnection}
                        className={`gap-2 ${hasConnection ? 'border-green-500 text-green-600' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        <Facebook className="h-4 w-4" />
                        {checkingConnection ? 'Checking...' : hasConnection ? 'Facebook Connected ✓' : connecting ? 'Connecting...' : 'Connect Facebook'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = '/api/targeting/super-target/export?format=xlsx'}
                        className="gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Export All
                    </Button>
                    <Button
                        onClick={handleSync}
                        disabled={syncing}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing from Facebook...' : 'Sync Now'}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Interests</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(stats.total)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Categories</CardTitle>
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.topics}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Top Interests Preview</CardTitle>
                    <CardDescription>
                        A preview of the top performing interests currently in the database.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Interest Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Max Audience Size</TableHead>
                                <TableHead className="text-right">FB ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">Loading...</TableCell>
                                </TableRow>
                            ) : interests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        Database is empty. Please sync to pull data.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                interests.map((interest) => (
                                    <TableRow key={interest.id}>
                                        <TableCell className="font-medium">{interest.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{interest.topic || 'General'}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {interest.audienceSizeUpperBound ? formatNumber(parseInt(interest.audienceSizeUpperBound)) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                            {interest.fbId}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
