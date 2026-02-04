'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Crown, User as UserIcon, Trash2, Facebook, Mail, Plus, X, Users } from 'lucide-react';
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
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState<TeamData | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    // Email member dialog
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberName, setNewMemberName] = useState('');
    const [isAddingEmail, setIsAddingEmail] = useState(false);

    // Error dialog state
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [hostImageError, setHostImageError] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');

    // Separate members by type
    const emailMembers = teamData?.members.filter(m => m.memberType === 'email') || [];
    const facebookMembers = teamData?.members.filter(m => m.memberType === 'facebook') || [];

    useEffect(() => {
        fetchTeamMembers();
    }, []);

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

    const handleAddMember = async () => {
        setIsAdding(true);
        try {
            const response = await fetch('/api/team/add-member');
            if (response.ok) {
                const data = await response.json();
                // Redirect to Facebook OAuth
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

    const handleAddEmailMember = async () => {
        if (!newMemberEmail || !newMemberName) {
            toast({
                title: "Error",
                description: "Please fill in all fields",
                variant: "destructive",
            });
            return;
        }

        setIsAddingEmail(true);
        try {
            const response = await fetch('/api/team/add-email-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newMemberEmail,
                    name: newMemberName,
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
        <div className="space-y-8">
            {/* ============ TEAM OWNER - COMPACT ============ */}
            {
                teamData?.host && (
                    <Card className="relative overflow-hidden border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200/30 rounded-full -translate-y-16 translate-x-16"></div>
                        <div className="relative p-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 p-0.5 shadow-lg">
                                            <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center overflow-hidden">
                                                {teamData.host.image && !hostImageError ? (
                                                    <img
                                                        src={teamData.host.image}
                                                        alt={teamData.host.name || 'Host'}
                                                        className="w-full h-full object-cover"
                                                        onError={() => setHostImageError(true)}
                                                    />
                                                ) : (
                                                    <svg className="w-8 h-8" viewBox="0 0 24 24">
                                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                                            <Crown className="h-3.5 w-3.5 text-yellow-900" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-gray-900">
                                                {teamData.host.name}
                                                {session?.user?.id === teamData.host.id && <span className="ml-2 text-xs font-normal text-gray-500">(You)</span>}
                                            </h3>
                                            <span className="px-2 py-0.5 bg-yellow-200 text-yellow-900 rounded-md text-xs font-bold">OWNER</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-0.5">{teamData.host.email}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-medium text-yellow-700">Full Access</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Google Account</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                )
            }

            {/* ============ GMAIL TEAM MEMBERS - MODERN GRID ============ */}
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
                            <p className="text-sm text-gray-500">
                                {emailMembers.length} {emailMembers.length === 1 ? 'member' : 'members'}
                            </p>
                        </div>
                    </div>
                    {session?.user?.id === teamData?.host.id && (
                        <Button
                            onClick={() => setShowEmailDialog(true)}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Member
                        </Button>
                    )}
                </div>

                {emailMembers.length === 0 ? (
                    <Card className="p-12 border-2 border-dashed border-gray-200 bg-gray-50/50">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-green-100 flex items-center justify-center">
                                <UserIcon className="h-10 w-10 text-green-600/60" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No team members yet</h3>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto">
                                {session?.user?.id === teamData?.host.id
                                    ? 'Start building your team by adding members via email'
                                    : 'No other members in this team'}
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-1.5">
                        {emailMembers.map((member) => {
                            const memberName = member.memberName || member.memberEmail || 'Unknown';
                            const initials = getInitials(memberName);
                            const colorClass = getAvatarColor(memberName);

                            return (
                                <div key={member.id} className="group h-[60px] flex items-center gap-3 px-4 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                                    {member.memberImage ? (
                                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                                            <img
                                                src={member.memberImage}
                                                alt={memberName}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const parent = target.parentElement;
                                                    if (parent) {
                                                        parent.className = `w-10 h-10 rounded-lg flex-shrink-0 shadow-sm bg-gradient-to-br ${colorClass} flex items-center justify-center text-white text-sm font-bold`;
                                                        parent.textContent = initials;
                                                    }
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className={`w-10 h-10 rounded-lg flex-shrink-0 shadow-sm bg-gradient-to-br ${colorClass} flex items-center justify-center text-white text-sm font-bold`}>
                                            {initials}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-900 truncate">{member.memberName}</span>
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex-shrink-0">
                                                {member.role}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">{member.memberEmail}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                        {new Date(member.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    {session?.user?.id === teamData?.host.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => setMemberToRemove(member)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Email Member Dialog - Modern Design */}
            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
                    <div className="relative bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                        <div className="relative flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Mail className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-white">Add Team Member</DialogTitle>
                                <DialogDescription className="text-blue-100 text-sm">
                                    Invite via email to join your team
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-semibold text-gray-700">Full Name</Label>
                            <Input
                                id="name"
                                placeholder="John Doe"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                className="h-11 border-2 focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john@example.com"
                                value={newMemberEmail}
                                onChange={(e) => setNewMemberEmail(e.target.value)}
                                className="h-11 border-2 focus:border-blue-500"
                            />
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                <strong>Access Level:</strong> Full team access to campaigns, ad accounts, and resources
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-0 gap-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowEmailDialog(false);
                                setNewMemberEmail('');
                                setNewMemberName('');
                            }}
                            disabled={isAddingEmail}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddEmailMember}
                            disabled={isAddingEmail || !newMemberEmail || !newMemberName}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        >
                            {isAddingEmail ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Member
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Member Confirmation Dialog */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl">
                            {t('settings.team.removeConfirmTitle', 'Remove team member?')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base space-y-2">
                            <p>
                                {t('settings.team.removeConfirmDesc', 'Are you sure you want to remove {name} from your team?').replace('{name}', memberToRemove?.memberType === 'email' ? memberToRemove?.memberName || '' : memberToRemove?.facebookName || '')}
                            </p>
                            <p className="font-semibold text-destructive">
                                This will immediately revoke their access to all team resources.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRemoving}>{t('launch.cancel', 'Cancel')}</AlertDialogCancel>
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
                                    {t('settings.team.remove', 'Remove Member')}
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Error Notification Dialog */}
            <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl text-destructive flex items-center gap-2">
                            <X className="h-5 w-5" />
                            Cannot Add Member
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base pt-2">
                            {errorMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setShowErrorDialog(false)}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
