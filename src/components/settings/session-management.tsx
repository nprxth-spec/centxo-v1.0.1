import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Laptop, Phone, Globe, Loader2, Trash2, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Session {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    lastActive: string;
    isCurrent: boolean;
    device: string;
    location: string | null;
}

export function SessionManagement() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const fetchSessions = async () => {
        try {
            const res = await fetch('/api/user/sessions');
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions);
            }
        } catch (error) {
            console.error('Failed to fetch sessions', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchSessions();

        // Trigger heartbeat to register current session
        fetch('/api/user/session-heartbeat', { method: 'POST' })
            .then(() => fetchSessions()) // Refresh after heartbeat
            .catch(err => console.error('Heartbeat failed', err));

        // Optional: Interval to refresh sessions ?
        // const interval = setInterval(fetchSessions, 30000);
        // return () => clearInterval(interval);
    }, []);

    const handleRevoke = async (sessionId: string) => {
        setRevokingId(sessionId);
        try {
            const res = await fetch(`/api/user/sessions?id=${sessionId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                toast({
                    title: "Session Revoked",
                    description: "The session has been successfully signed out.",
                });
                setSessions(prev => prev.filter(s => s.id !== sessionId));
            } else {
                throw new Error('Failed to revoke');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to revoke session. Please try again.",
                variant: "destructive",
            });
        } finally {
            setRevokingId(null);
        }
    };

    const getDeviceIcon = (ua: string | null, type: string) => {
        if (!ua) return <Globe className="h-5 w-5" />;
        const lowerUA = ua.toLowerCase();
        if (lowerUA.includes('mobile') || lowerUA.includes('android') || lowerUA.includes('iphone')) {
            return <Smartphone className="h-5 w-5" />;
        }
        return <Monitor className="h-5 w-5" />;
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h3 className="text-lg font-medium">{t('settings.sessions', 'Session Management')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('settings.sessionsDesc', 'Manage your active sessions and devices.')}
                </p>
            </div>

            <div className="space-y-4">
                {sessions.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-lg">
                        No active sessions found.
                    </div>
                )}

                {sessions.map((session) => (
                    <Card key={session.id}>
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-full">
                                        {getDeviceIcon(session.userAgent, 'desktop')}
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm md:text-base">
                                            {session.device}
                                            {session.isCurrent && " (This Device)"}
                                        </CardTitle>
                                        <CardDescription className="text-xs md:text-sm truncate max-w-[200px] sm:max-w-md">
                                            {session.ipAddress || 'Unknown IP'} • {session.location || 'Unknown Location'}
                                        </CardDescription>
                                    </div>
                                </div>
                                {session.isCurrent && (
                                    <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full font-medium w-fit">
                                        Current Session
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
                                <div className="text-muted-foreground flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    Last active: {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                                </div>
                                {!session.isCurrent && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto"
                                        onClick={() => handleRevoke(session.id)}
                                        disabled={revokingId === session.id}
                                    >
                                        {revokingId === session.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Trash2 className="h-4 w-4 mr-2" />
                                        )}
                                        Revoke
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
