'use client';

import { useSession, signIn } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, ExternalLink, AlertCircle, Facebook, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TeamMember {
    id: string;
    memberType: 'facebook' | 'email';
    facebookUserId?: string;
    facebookName?: string;
    facebookEmail?: string;
    memberEmail?: string;
    memberName?: string;
    role: string;
    addedAt: string;
    pictureUrl?: string;
    memberImage?: string | null;
}

interface TeamData {
    host: {
        id: string;
        name: string;
        email: string;
        image?: string;
        role: string;
    };
    members: TeamMember[];
}

export function ConnectionsSettings({ onAccountAdded }: { onAccountAdded?: () => void }) {
    const { t } = useLanguage();
    const { data: session } = useSession();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [isFacebookConnected, setIsFacebookConnected] = useState(false);
    const [checkingConnection, setCheckingConnection] = useState(true);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [teamData, setTeamData] = useState<TeamData | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [mainFacebookProfile, setMainFacebookProfile] = useState<{ name: string; image: string } | null>(null);

    const facebookMembers = teamData?.members.filter(m => m.memberType === 'facebook') || [];

    useEffect(() => {
        // Show content immediately when session is ready (don't block on fetches)
        if (session !== undefined) {
            setLoading(false);
        }
        if (session?.user) {
            fetchConnectionsData();
        }

        // Check for success/error callback from Meta OAuth
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
            setSuccessMessage('Facebook connected successfully!');
            setTimeout(() => {
                fetchConnectionsData(true); // Force refresh to show new connection
                onAccountAdded?.(); // Signal that a new account was added
                setSuccessMessage('');
            }, 3000);

            // Clean up URL
            const url = new URL(window.location.href);
            url.searchParams.delete('success');
            url.searchParams.delete('error');
            window.history.replaceState({}, '', url.pathname + url.search);
        }

        // Check for member_added callback
        if (urlParams.get('success') === 'member_added') {
            setSuccessMessage('Facebook account added successfully!');
            setTimeout(() => {
                fetchConnectionsData(true); // Force refresh to show new member
                onAccountAdded?.(); // Signal that a new account was added
                setSuccessMessage('');
            }, 1000);

            // Clean up URL
            const url = new URL(window.location.href);
            url.searchParams.delete('success');
            url.searchParams.delete('error');
            window.history.replaceState({}, '', url.pathname + url.search);
        }

        const error = urlParams.get('error');
        if (error) {
            setErrorMessage(
                error === 'callback_failed' ? 'Failed to connect Facebook. Please try again.' :
                    error === 'missing_code' ? 'Connection cancelled or invalid.' :
                        error === 'user_not_found' ? 'User not found.' :
                            error === 'already_exists' ? 'This Facebook account is already added.' :
                                'An error occurred while connecting Facebook.'
            );
            setTimeout(() => setErrorMessage(''), 5000);

            // Clean up URL
            const url = new URL(window.location.href);
            url.searchParams.delete('success');
            url.searchParams.delete('error');
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    }, [session]);

    const fetchConnectionsData = async (forceRefresh = false) => {
        setCheckingConnection(true);
        try {
            const url = forceRefresh ? '/api/connections/data?refresh=true' : '/api/connections/data';
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();

            const launch = data.launch || {};
            const team = data.team || {};
            const profile = data.facebookProfile;

            setIsFacebookConnected(launch.checks?.metaConnected || false);
            setTeamData(team?.host ? team : null);

            if (profile?.name && profile?.userId) {
                const imageUrl = profile.pictureUrl || `https://graph.facebook.com/${profile.userId}/picture?type=large&width=200&height=200`;
                setMainFacebookProfile({ name: profile.name, image: imageUrl });
            } else if (session?.user?.email && team?.members) {
                const userFacebookAccount = team.members.find(
                    (m: TeamMember) => m.memberType === 'facebook' && m.facebookEmail === session.user?.email
                );
                if (userFacebookAccount) {
                    setMainFacebookProfile({
                        name: userFacebookAccount.facebookName || 'Facebook User',
                        image: userFacebookAccount.facebookUserId
                            ? `https://graph.facebook.com/${userFacebookAccount.facebookUserId}/picture?type=normal`
                            : ''
                    });
                }
            }

        } catch (error) {
            console.error('Error fetching connections data:', error);
        } finally {
            setCheckingConnection(false);
        }
    };

    const handleConnectFacebook = async () => {
        setConnecting(true);
        try {
            // Use NextAuth signIn instead of custom OAuth
            await signIn('facebook', {
                callbackUrl: '/settings?section=connections&success=true',
            });
        } catch (error) {
            console.error('Error connecting Facebook:', error);
            setErrorMessage('Failed to connect Facebook. Please try again.');
        } finally {
            setConnecting(false);
        }
    };

    const handleAddMember = async () => {
        setIsAdding(true);
        try {
            const returnTo = encodeURIComponent('/settings/connections?tab=connections');
            const response = await fetch(`/api/team/add-member?returnTo=${returnTo}`);
            if (response.ok) {
                const data = await response.json();
                window.location.href = data.authUrl;
            } else {
                throw new Error('Failed to initiate OAuth');
            }
        } catch (error) {
            console.error('Error adding member:', error);
            toast({
                title: "Error",
                description: "Failed to add team member",
                variant: "destructive",
            });
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;

        setIsRemoving(true);
        try {
            const response = await fetch(`/api/team/remove-member/${memberToRemove.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Team member removed successfully",
                });
                await fetchConnectionsData();
            } else {
                throw new Error('Failed to remove member');
            }
        } catch (error) {
            console.error('Error removing member:', error);
            toast({
                title: "Error",
                description: "Failed to remove team member",
                variant: "destructive",
            });
        } finally {
            setIsRemoving(false);
            setMemberToRemove(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header removed - moved to layout */}

            {/* Success/Error Messages */}
            {successMessage && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}

            {errorMessage && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {/* Facebook Connections Section */}
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                            <Facebook className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Facebook Accounts</h2>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                {checkingConnection ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>{t('common.loading', 'Loading…')}</span>
                                    </>
                                ) : (
                                    <>
                                        {facebookMembers.length} {facebookMembers.length === 1 ? 'account' : 'accounts'}
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleAddMember}
                        disabled={isAdding}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                        {isAdding ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Account
                            </>
                        )}
                    </Button>
                </div>

                {/* Facebook Members List */}

                {checkingConnection && !teamData ? (
                    <div className="space-y-1.5">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-[60px] flex items-center gap-3 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50/50 animate-pulse">
                                <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-gray-200" />
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-32" />
                                    <div className="h-3 bg-gray-100 rounded w-40" />
                                </div>
                                <div className="h-3 bg-gray-100 rounded w-16 flex-shrink-0" />
                            </div>
                        ))}
                    </div>
                ) : facebookMembers.length === 0 ? (
                    <Card className="p-12 border-2 border-dashed border-gray-200 bg-gray-50/50">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
                                <Facebook className="h-10 w-10 text-blue-600/60" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Facebook accounts yet</h3>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto">
                                {session?.user?.id === teamData?.host.id
                                    ? 'Add Facebook accounts to manage ads and campaigns'
                                    : 'No Facebook accounts in this team'}
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-1.5">
                        {facebookMembers.map((member) => {
                            const displayName = member.facebookName || 'Facebook User';
                            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                            const pictureUrl = member.facebookUserId
                                ? `/api/facebook/profile-picture?userId=${encodeURIComponent(member.facebookUserId)}`
                                : null;

                            return (
                                <div key={member.id} className="group h-[60px] flex items-center gap-3 px-4 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                                    {pictureUrl ? (
                                        <div className="w-10 h-10 rounded-lg flex-shrink-0 shadow-sm overflow-hidden">
                                            <img
                                                src={pictureUrl}
                                                alt={displayName}
                                                className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const parent = target.parentElement;
                                                    if (parent && !parent.querySelector('.fb-fallback')) {
                                                        parent.className = 'w-10 h-10 rounded-lg flex-shrink-0 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold fb-fallback';
                                                        parent.textContent = initials;
                                                    }
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg flex-shrink-0 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                                            {initials}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-900 truncate">{member.facebookName}</span>
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex-shrink-0">
                                                Facebook
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">{member.facebookEmail}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                        {new Date(member.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => setMemberToRemove(member)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Remove Member Confirmation Dialog */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl">
                            Remove team member?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base space-y-2">
                            <div>
                                Are you sure you want to remove {memberToRemove?.facebookName || ''} from your team?
                            </div>
                            <div className="font-semibold text-destructive">
                                This will immediately revoke their access to all team resources.
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveMember}
                            disabled={isRemoving}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isRemoving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove Member
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
