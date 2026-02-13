'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useConfig } from '@/contexts/AdAccountContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Crown, User as UserIcon, Trash2, Facebook, Mail, Plus, X, Users, ExternalLink, CheckCircle2, AlertCircle, Search, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Avatar,
    AvatarImage,
    AvatarFallback,
} from "@/components/ui/avatar";
import { getRoleConfig, ASSIGNABLE_ROLES } from '@/lib/role-utils';

interface TeamMember {
    id: string;
    memberType: 'facebook' | 'email';
    // Facebook members
    facebookUserId?: string;
    facebookName?: string;
    facebookEmail?: string;
    // Email members
    memberEmail?: string;
    memberName?: string;
    memberImage?: string; // Profile image URL
    role: string;
    addedAt: string;
    linkedFacebook?: { name: string; email: string } | null;
}

interface FacebookConnection {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    roleLabel: string;
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
    facebookConnections?: FacebookConnection[];
}

// Helper function to get initials from name
const getInitials = (name: string) => {
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

// Helper to get random gradient color for avatar
const getAvatarColor = (str: string) => {
    const colors = [
        'from-blue-500 to-indigo-600',
        'from-green-500 to-emerald-600',
        'from-purple-500 to-pink-600',
        'from-orange-500 to-red-600',
        'from-teal-500 to-cyan-600',
        'from-violet-500 to-purple-600',
    ];
    const index = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
};

export function TeamSettings() {
    const { t } = useLanguage();
    const { data: session } = useSession();
    const { planLimits } = useConfig();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState<TeamData | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Email member dialog
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberRole, setNewMemberRole] = useState<'ADMIN' | 'EMPLOYEE'>('EMPLOYEE');
    const [isAddingEmail, setIsAddingEmail] = useState(false);

    // Error dialog state
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [hostImageError, setHostImageError] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');

    // Meta connection state
    const [isMetaConnected, setIsMetaConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [checkingMetaConnection, setCheckingMetaConnection] = useState(false);

    // Separate members by type and filter by search term
    const allMembers = teamData?.members || [];
    const filteredMembers = allMembers.filter(member => {
        const name = (member.memberName || member.facebookName || '').toLowerCase();
        const email = (member.memberEmail || member.facebookEmail || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || email.includes(search);
    });

    useEffect(() => {
        fetchTeamMembers();
        checkMetaConnection();
    }, []);

    // Handle Meta OAuth callback success/error messages
    useEffect(() => {
        const metaSuccess = searchParams.get('metaSuccess');
        const metaError = searchParams.get('metaError');

        if (metaSuccess === 'true') {
            toast({
                title: "Success",
                description: "Meta account connected successfully!",
            });
            // Remove query params
            router.replace('/settings?tab=team');
            // Refresh connection status
            setTimeout(() => checkMetaConnection(), 500);
        } else if (metaError) {
            const errorMsg = searchParams.get('error_msg');
            const errorReason = searchParams.get('error_reason');

            const errorMessages: Record<string, string> = {
                'missing_code': 'Missing authorization code. Please try again.',
                'user_not_found': 'User not found. Please try logging in again.',
                'callback_failed': errorMsg ? `Failed to connect: ${errorMsg}` : 'Failed to connect Meta account. Please try again.',
                'oauth_error': errorReason ? `Facebook authorization error: ${errorReason}` : 'Facebook authorization failed. Please try again.',
                'config_error': 'Server configuration error. Please contact support.',
            };

            toast({
                title: "Error",
                description: errorMessages[metaError] || 'Failed to connect Meta account.',
                variant: "destructive",
            });
            // Remove query params
            router.replace('/settings?tab=team');
        }
    }, [searchParams, router, toast]);

    const checkMetaConnection = async () => {
        setCheckingMetaConnection(true);
        try {
            const res = await fetch('/api/launch');
            if (res.ok) {
                const data = await res.json();
                setIsMetaConnected(data.checks?.metaConnected || false);
            }
        } catch (error) {
            console.error('Error checking Meta connection:', error);
        } finally {
            setCheckingMetaConnection(false);
        }
    };

    const handleReconnectMeta = async () => {
        setIsReconnecting(true);
        try {
            const response = await fetch('/api/meta/connect');
            const data = await response.json();

            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else {
                const errorMsg = data.error || 'Failed to initiate Facebook connection';
                toast({
                    title: "Error",
                    description: errorMsg,
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error reconnecting Meta:', error);
            toast({
                title: "Error",
                description: "An error occurred. Please check your Facebook App settings and ensure the redirect URI is configured correctly.",
                variant: "destructive",
            });
        } finally {
            setIsReconnecting(false);
        }
    };

    const fetchTeamMembers = async () => {
        try {
            // Add timestamp to prevent caching
            const response = await fetch(`/api/team/members?_t=${Date.now()}`);
            if (response.ok) {
                const data = await response.json();
                setTeamData(data);
            }
        } catch (error) {
            console.error('Error fetching team members:', error);
            toast({
                title: "Error",
                description: "Failed to load team members",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const memberLimit = planLimits.teamMembers;
    const atMemberLimit = (teamData?.members?.length ?? 0) >= memberLimit;

    const handleAddMember = async () => {
        if (atMemberLimit) return;
        setIsAdding(true);
        try {
            const response = await fetch('/api/team/add-member');
            const data = await response.json();
            if (response.ok) {
                window.location.href = data.authUrl;
            } else if (response.status === 403) {
                setErrorMessage(data.error || 'Team member limit reached');
                setShowErrorDialog(true);
            } else {
                throw new Error(data.error || 'Failed to initiate OAuth');
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

    const handleAddEmailMember = async () => {
        if (!newMemberEmail) {
            toast({
                title: "Error",
                description: "Please enter an email address",
                variant: "destructive",
            });
            return;
        }

        setIsAddingEmail(true);
        try {
            // If comma separated, we might want to loop or handle on backend.
            // For now, let's just use the first one or send as is if backend supports it.
            // The previous logic sent one member. I'll stick to one for now but allow omitting name.
            const response = await fetch('/api/team/add-email-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newMemberEmail,
                    name: newMemberEmail.split('@')[0], // Use email prefix as default name
                    role: newMemberRole,
                }),
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Team member added successfully",
                });
                setShowEmailDialog(false);
                setNewMemberEmail('');
                setNewMemberName('');
                setNewMemberRole('EMPLOYEE');
                fetchTeamMembers();
            } else {
                const error = await response.json();
                // Show error dialog instead of toast for API errors (like duplicate member)
                setErrorMessage(error.error || 'Failed to add member');
                setShowErrorDialog(true);
            }
        } catch (error: any) {
            console.error('Error adding email member:', error);
            // Keep toast for network/unexpected errors
            toast({
                title: "Error",
                description: error.message || "Failed to add team member",
                variant: "destructive",
            });
        } finally {
            setIsAddingEmail(false);
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
                // Refresh team members
                await fetchTeamMembers();
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
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-page-title">Team</h1>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg h-10"
                        />
                    </div>

                </div>
            </div>

            {/* Facebook Accounts - table same style as Team Members */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h2 className="text-section-title">
                        {t('settings.team.facebookAccounts', 'Facebook Accounts')}
                    </h2>
                    {checkingMetaConnection ? (
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('common.checking', 'Checking...')}
                        </span>
                    ) : (
                        <Button
                            variant={isMetaConnected ? 'outline' : 'default'}
                            size="sm"
                            onClick={handleReconnectMeta}
                            disabled={isReconnecting}
                            className={!isMetaConnected ? 'bg-[#1877f2] hover:bg-[#166fe5] text-white' : 'border-gray-200'}
                        >
                            {isReconnecting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : isMetaConnected ? (
                                <ExternalLink className="h-4 w-4 mr-2" />
                            ) : (
                                <Facebook className="h-4 w-4 mr-2" />
                            )}
                            {isMetaConnected ? t('settings.meta.reconnect', 'Reconnect Meta') : t('settings.meta.connectFacebook', 'Connect Facebook')}
                        </Button>
                    )}
                </div>

                <Card className="border border-gray-200 bg-white shadow-sm overflow-hidden rounded-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {!(teamData?.facebookConnections?.length) ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground bg-card">
                                            <div className="flex flex-col items-center gap-2">
                                                <Facebook className="h-8 w-8 text-muted-foreground/50" />
                                                <p>{t('settings.adAccounts.noConnected', 'No Facebook Accounts Connected')}</p>
                                                <p className="text-sm">{t('settings.meta.connectDesc', 'Connect your Facebook account to use Meta features')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    (teamData?.facebookConnections ?? []).map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="w-10 h-10 border border-gray-200 shrink-0">
                                                        <AvatarImage src={row.image || undefined} alt={row.name} />
                                                        <AvatarFallback className="bg-blue-50 text-blue-600">
                                                            <Facebook className="h-5 w-5" />
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-foreground">{row.name}</div>
                                                        {row.email ? <div className="text-sm text-muted-foreground truncate">{row.email}</div> : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1877f2] shrink-0">
                                                        <Facebook className="h-4 w-4 text-white" />
                                                    </span>
                                                    <span className="text-sm text-green-600 font-medium">{t('settings.team.facebookConnected', 'Connected')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {row.role === 'OWNER' && session?.user?.id === row.id && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleReconnectMeta}
                                                        disabled={isReconnecting}
                                                        className="text-muted-foreground hover:text-foreground"
                                                    >
                                                        {isReconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Team Members Section */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h2 className="text-section-title">Team Members</h2>
                    {(session?.user?.id === teamData?.host.id || teamData?.members.find(m => (m.memberEmail || m.facebookEmail) === session?.user?.email)?.role === 'ADMIN') && (
                        <Button
                            onClick={() => { if (atMemberLimit) { setErrorMessage(`Your plan allows up to ${memberLimit} team member(s). Upgrade to add more.`); setShowErrorDialog(true); } else setShowEmailDialog(true); }}
                            disabled={atMemberLimit}
                            className="w-full sm:w-auto bg-[#0070f3] hover:bg-blue-700 text-white px-6 h-10 font-medium transition-colors"
                        >
                            + Add member
                        </Button>
                    )}
                </div>

                <Card className="border border-gray-200 bg-white shadow-sm overflow-hidden rounded-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Facebook</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {/* Host (Owner) */}
                                {teamData?.host && !searchTerm && (
                                    <tr className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Avatar className="w-10 h-10 border border-gray-200">
                                                        <AvatarImage
                                                            src={teamData.host.image || undefined}
                                                            alt={teamData.host.name}
                                                        />
                                                        <AvatarFallback className="bg-muted text-muted-foreground">
                                                            <UserIcon className="h-5 w-5" />
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                                                        <Crown className="h-2 w-2 text-yellow-900" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="font-medium text-foreground flex items-center gap-1.5">
                                                        {teamData.host.name}
                                                        {session?.user?.id === teamData.host.id && <span className="text-xs font-normal text-muted-foreground">(You)</span>}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">{teamData.host.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {(() => {
                                            const ownerFb = (teamData?.facebookConnections ?? []).find(fc => fc.role === 'OWNER');
                                            return (
                                                <td className="px-6 py-4">
                                                    {ownerFb?.name ? (
                                                        <div className="flex items-center gap-2">
                                                            <Facebook className="h-4 w-4 text-blue-500 shrink-0" />
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium text-foreground truncate">{ownerFb.name}</div>
                                                                {ownerFb.email && <div className="text-xs text-muted-foreground truncate">{ownerFb.email}</div>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Not connected</span>
                                                    )}
                                                </td>
                                            );
                                        })()}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                </svg>
                                                <span className="px-2.5 py-0.5 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium border border-yellow-100">
                                                    Owner
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem disabled>Owner settings</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                )}

                                {filteredMembers.map((member) => {
                                    const memberName = member.memberName || member.facebookName || 'Unknown';
                                    const memberEmail = member.memberEmail || member.facebookEmail || '';
                                    const initials = getInitials(memberName);
                                    const colorClass = getAvatarColor(memberName);

                                    return (
                                        <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="w-10 h-10 border border-gray-200">
                                                        <AvatarImage src={member.memberImage || undefined} alt={memberName} />
                                                        <AvatarFallback className={`bg-gradient-to-br ${colorClass} text-white text-xs font-bold`}>
                                                            {initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium text-foreground">{memberName}</div>
                                                        <div className="text-sm text-muted-foreground">{memberEmail}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {member.linkedFacebook?.name ? (
                                                    <div className="flex items-center gap-2">
                                                        <Facebook className="h-4 w-4 text-blue-500 shrink-0" />
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-medium text-foreground truncate">{member.linkedFacebook.name}</div>
                                                            {member.linkedFacebook.email && <div className="text-xs text-muted-foreground truncate">{member.linkedFacebook.email}</div>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Not connected</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
                                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                    </svg>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleConfig(member.role).color.replace('bg-', 'bg-opacity-10 border-').replace('text-', 'text-')}`}>
                                                        {getRoleConfig(member.role).label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {session?.user?.id === teamData?.host.id && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem
                                                                onClick={async () => {
                                                                    const newRole = member.role === 'ADMIN' ? 'EMPLOYEE' : 'ADMIN';
                                                                    try {
                                                                        const res = await fetch('/api/team/update-member-role', {
                                                                            method: 'PATCH',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ memberId: member.id, role: newRole }),
                                                                        });
                                                                        if (res.ok) {
                                                                            fetchTeamMembers();
                                                                            toast({ title: 'Success', description: `Changed to ${newRole.toLowerCase()}` });
                                                                        }
                                                                    } catch (e) {
                                                                        toast({ title: 'Error', description: 'Failed to update role', variant: 'destructive' });
                                                                    }
                                                                }}
                                                            >
                                                                Change to {member.role === 'ADMIN' ? 'Employee' : 'Admin'}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                                onClick={() => setMemberToRemove(member)}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Remove Member
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {((filteredMembers.length === 0 && !!searchTerm) || (filteredMembers.length === 0 && !teamData?.host)) && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground bg-card">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users className="h-8 w-8 text-muted-foreground/50" />
                                                <p>No team members found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>



            {/* Add Email Member Dialog */}
            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-8 pb-0">
                        <DialogTitle className="text-dialog-title">Add member</DialogTitle>
                    </DialogHeader>

                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-label">Email address(es)</Label>
                                <Input
                                    id="email"
                                    placeholder="Enter email addresses"
                                    value={newMemberEmail}
                                    onChange={(e) => setNewMemberEmail(e.target.value)}
                                    className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                                />
                                <p className="text-caption">Comma separated for multiple invites</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-label">Role(s)</Label>
                                <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as 'ADMIN' | 'EMPLOYEE')}>
                                    <SelectTrigger className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg">
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-caption">Select the initial role for these members</p>
                            </div>
                        </div>

                        {/* Error message placeholder if needed */}
                        {errorMessage && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 border border-red-100">
                                <AlertCircle className="h-4 w-4" />
                                {errorMessage}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 p-6 bg-gray-50">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setShowEmailDialog(false);
                                setErrorMessage('');
                            }}
                            className="text-muted-foreground hover:text-foreground px-6 h-11 font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddEmailMember}
                            disabled={isAddingEmail || !newMemberEmail}
                            className="bg-[#0070f3] hover:bg-blue-700 text-white px-8 h-11 font-medium rounded-lg"
                        >
                            {isAddingEmail ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Wait...
                                </>
                            ) : (
                                'Add member'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Remove Member Confirmation Dialog */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-dialog-title">
                            Remove team member?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-base mt-2">
                            Are you sure you want to remove <span className="font-semibold text-foreground">{memberToRemove?.memberName || memberToRemove?.memberEmail}</span> from your team?
                            This will immediately revoke their access.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="h-11 px-6 border-border text-foreground rounded-lg">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveMember}
                            disabled={isRemoving}
                            className="h-11 px-8 bg-red-600 hover:bg-red-700 text-white rounded-lg border-none"
                        >
                            {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove member'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Error Notification Dialog (Limit reached, etc) */}
            <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-dialog-title flex items-center gap-3">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                            Action restricted
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-base mt-2">
                            {errorMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8">
                        <AlertDialogAction onClick={() => setShowErrorDialog(false)} className="h-11 px-8 bg-gray-900 hover:bg-black text-white rounded-lg border-none">
                            Understood
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
