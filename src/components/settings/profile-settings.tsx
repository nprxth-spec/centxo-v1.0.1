'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Trash2, Loader2, CheckCircle2, Link2, Unlink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

const GoogleIcon = () => (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const FacebookIcon = () => (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="12" fill="#1877F2" />
        <path d="M16.5 12H14v-1.5c0-.6.4-.75.75-.75H16.5V7.5h-2.25C12.1 7.5 11 8.68 11 10.5V12H9v2.25h2V22h3v-7.75h2l.5-2.25z" fill="white" />
    </svg>
);

export function ProfileSettings() {
    const { t } = useLanguage();
    const { data: session, update } = useSession();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastSavedNameRef = useRef<string>('');

    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        role: '',
    });
    const [profileImage, setProfileImage] = useState<string>('');
    const [accountProvider, setAccountProvider] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showRemoveDialog, setShowRemoveDialog] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Password change state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [hasPassword, setHasPassword] = useState<boolean | null>(null);

    // Connected accounts state
    const [connectedAccounts, setConnectedAccounts] = useState<{ provider: string; email: string }[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);
    const [confirmDisconnectProvider, setConfirmDisconnectProvider] = useState<string | null>(null);

    // Fetch connected OAuth providers
    const fetchConnectedAccounts = async () => {
        setIsLoadingAccounts(true);
        try {
            const res = await fetch('/api/user/connected-accounts');
            if (res.ok) {
                const data = await res.json();
                setConnectedAccounts(data.accounts || []);
            }
        } catch {
            // silent
        } finally {
            setIsLoadingAccounts(false);
        }
    };

    // Handle link success/error from Google/Facebook OAuth callback
    useEffect(() => {
        const linkSuccess = searchParams.get('linkSuccess');
        const linkError = searchParams.get('linkError');
        if (linkSuccess) {
            const providerLabel = linkSuccess === 'google' ? 'Google' : 'Facebook';
            toast({ title: 'Account linked', description: `${providerLabel} account connected successfully.` });
            fetchConnectedAccounts();
            router.replace('/settings?tab=profile');
        } else if (linkError) {
            const messages: Record<string, string> = {
                google_denied: 'Google sign-in was cancelled.',
                google_token: 'Failed to get Google token. Please try again.',
                google_profile: 'Failed to fetch Google profile. Please try again.',
                google_already_linked_to_other: 'This Google account is already linked to another user.',
                user_not_found: 'User session not found. Please log in again.',
                google_error: 'An unexpected error occurred. Please try again.',
            };
            toast({
                title: 'Link failed',
                description: messages[linkError] || 'Failed to connect account.',
                variant: 'destructive',
            });
            router.replace('/settings?tab=profile');
        }
    }, [searchParams]);

    // Disconnect a provider
    const handleDisconnect = async (provider: string) => {
        setDisconnectingProvider(provider);
        try {
            const res = await fetch('/api/user/disconnect-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
            });
            const data = await res.json();
            if (res.ok) {
                toast({ title: 'Account disconnected', description: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account removed.` });
                fetchConnectedAccounts();
            } else {
                toast({ title: 'Error', description: data.error || 'Failed to disconnect.', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
        } finally {
            setDisconnectingProvider(null);
            setConfirmDisconnectProvider(null);
        }
    };

    useEffect(() => {
        if (session?.user) {
            const fetchProfile = async () => {
                try {
                    const res = await fetch('/api/user/account-profile');
                    if (res.ok) {
                        const data = await res.json();
                        const dName = data.displayName || session.user?.name || '';
                        setFormData({
                            displayName: dName,
                            email: data.displayEmail || session.user?.email || '',
                            role: 'Host (Owner)',
                        });
                        lastSavedNameRef.current = dName;
                        setProfileImage(data.displayImage || session.user?.image || '');
                        setAccountProvider(data.provider || null);
                    } else {
                        const dName = session.user?.name || '';
                        setFormData({
                            displayName: dName,
                            email: session.user?.email || '',
                            role: 'Host (Owner)',
                        });
                        lastSavedNameRef.current = dName;
                        setProfileImage(session.user?.image || '');
                    }
                } catch {
                    const dName = session.user?.name || '';
                    setFormData({
                        displayName: dName,
                        email: session.user?.email || '',
                        role: 'Host (Owner)',
                    });
                    lastSavedNameRef.current = dName;
                    setProfileImage(session.user?.image || '');
                }
            };
            fetchProfile();

            const checkPassword = async () => {
                try {
                    const response = await fetch('/api/user/has-password');
                    if (response.ok) {
                        const data = await response.json();
                        setHasPassword(data.hasPassword);
                    }
                } catch (error) {
                    console.error('Error checking password:', error);
                }
            };
            checkPassword();
            fetchConnectedAccounts();
        }
    }, [session]);

    const getInitials = (name: string) => {
        if (!name) return '??';
        const names = name.split(' ');
        if (names.length > 1) {
            return names[0][0] + names[names.length - 1][0];
        }
        return name.substring(0, 2);
    };

    const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast({
                title: "Invalid file type",
                description: "Please upload a JPEG, PNG, GIF, or WebP image.",
                variant: "destructive",
            });
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast({
                title: "File too large",
                description: "Please upload an image smaller than 5MB.",
                variant: "destructive",
            });
            return;
        }

        setIsUploading(true);

        try {
            // Create FormData for upload
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/user/upload-avatar', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            const data = await response.json();
            setProfileImage(data.imageUrl);

            // Update session
            await update({
                ...session,
                user: {
                    ...session?.user,
                    image: data.imageUrl,
                },
            });

            toast({
                title: "Success",
                description: "Profile photo updated successfully.",
            });
        } catch (error) {
            console.error('Error uploading photo:', error);
            toast({
                title: "Error",
                description: "Failed to upload photo. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemovePhoto = async () => {
        setIsUploading(true);
        try {
            const response = await fetch('/api/user/remove-avatar', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to remove image');
            }

            setProfileImage('');

            // Update session
            await update({
                ...session,
                user: {
                    ...session?.user,
                    image: null,
                },
            });

            toast({
                title: "Success",
                description: "Profile photo removed successfully.",
            });
        } catch (error) {
            console.error('Error removing photo:', error);
            toast({
                title: "Error",
                description: "Failed to remove photo. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
            setShowRemoveDialog(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/user/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formData.displayName,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            // Update session
            await update({
                ...session,
                user: {
                    ...session?.user,
                    name: formData.displayName,
                },
            });

            lastSavedNameRef.current = formData.displayName;
            setHasChanges(false);

            toast({
                title: "Success",
                description: "Profile updated successfully.",
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            toast({
                title: "Error",
                description: "Failed to update profile. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNameChange = (value: string) => {
        setFormData({ ...formData, displayName: value });
        setHasChanges(value !== lastSavedNameRef.current);
    };

    const handlePasswordChange = async () => {
        // Validation
        if (!passwordData.newPassword || !passwordData.confirmPassword) {
            toast({
                title: "Error",
                description: "Please fill in all password fields.",
                variant: "destructive",
            });
            return;
        }

        // Only require current password if user already has one
        if (hasPassword && !passwordData.currentPassword) {
            toast({
                title: "Error",
                description: "Please enter your current password.",
                variant: "destructive",
            });
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast({
                title: "Error",
                description: "New passwords do not match.",
                variant: "destructive",
            });
            return;
        }

        if (passwordData.newPassword.length < 8) {
            toast({
                title: "Error",
                description: "Password must be at least 8 characters long.",
                variant: "destructive",
            });
            return;
        }

        setIsChangingPassword(true);
        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword: hasPassword ? passwordData.currentPassword : undefined,
                    newPassword: passwordData.newPassword,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to change password');
            }

            toast({
                title: "Success",
                description: hasPassword ? "Password changed successfully." : "Password set successfully.",
            });

            // Reset form and update hasPassword state
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
            setShowPasswordSection(false);
            if (!hasPassword) {
                setHasPassword(true);
            }
        } catch (error) {
            console.error('Error changing password:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update password. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-0.5">
                <h2 className="text-page-title">{t('settings.accountSettings', 'Account Settings')}</h2>
                <p className="text-sm md:text-base text-muted-foreground">
                    {t('settings.accountSubtitle', 'Manage your account information and preferences')}
                </p>
            </div>
            <div className="my-6 h-[1px] bg-border" />

            <div className="grid gap-6 lg:grid-cols-12 items-start">
                {/* Side Column: Profile Picture Card */}
                <div className="lg:col-span-4">
                    <div className="flex flex-col items-center text-center gap-4 md:gap-6 p-4 md:p-6 border border-border/60 rounded-lg bg-card/40 shadow-sm">
                        <div className="relative group">
                            <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-xl">
                                <AvatarImage src={profileImage} alt={formData.displayName} className="object-cover" />
                                <AvatarFallback className="text-3xl md:text-5xl bg-muted text-muted-foreground">
                                    {getInitials(formData.displayName)}
                                </AvatarFallback>
                            </Avatar>
                            {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                    <Loader2 className="h-10 w-10 text-white animate-spin" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 text-center">
                            <h3 className="font-semibold text-lg md:text-2xl tracking-tight">{formData.displayName || 'User'}</h3>
                            <p className="text-xs md:text-sm text-muted-foreground break-all">{formData.email}</p>
                            {accountProvider && (
                                <Badge
                                    variant="secondary"
                                    className="mt-2 gap-1.5 font-normal"
                                >
                                    {accountProvider === 'facebook' && (
                                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 2.848-5.978 5.817-5.978.33 0 3.165.178 3.165.178v3.39H16.27c-2.095 0-2.625 1.106-2.625 2.03v1.96h3.848l-.519 3.667h-3.329v7.98h-4.544z" />
                                        </svg>
                                    )}
                                    {accountProvider === 'google' && (
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                    )}
                                    {accountProvider === 'facebook' ? t('settings.profile.signedInFacebook', 'Signed in with Facebook') : accountProvider === 'google' ? t('settings.profile.signedInGoogle', 'Signed in with Google') : null}
                                </Badge>
                            )}
                        </div>

                        <div className="w-full h-[1px] bg-border/50" />

                        <div className="flex flex-col gap-3 w-full">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={handlePhotoChange}
                                className="hidden"
                            />
                            <Button
                                variant="outline"
                                className="w-full gap-2 h-10 border-primary/20 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-300"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                            >
                                <Camera className="h-4 w-4" />
                                {t('settings.profile.changePhoto', 'Change Photo')}
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                onClick={() => setShowRemoveDialog(true)}
                                disabled={isUploading || !profileImage}
                            >
                                <Trash2 className="h-4 w-4" />
                                {t('settings.profile.removePhoto', 'Remove Photo')}
                            </Button>
                        </div>
                        <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                            {t('settings.profile.supports', 'Supports JPEG, PNG, GIF, WebP (Max 5MB)')}
                        </p>
                    </div>
                </div>

                {/* Main Column: Form Fields Card */}
                <div className="lg:col-span-8">
                    <div className="grid gap-6 md:gap-8 p-4 md:p-8 border border-border/60 rounded-lg bg-card/40 shadow-sm">
                        <div className="space-y-6">
                            {/* Display Name */}
                            <div className="grid gap-2">
                                <Label htmlFor="displayName" className="text-sm font-medium">
                                    {t('settings.profile.displayName', 'Display Name')}
                                </Label>
                                <Input
                                    id="displayName"
                                    value={formData.displayName}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    className="max-w-full bg-background/50 focus:bg-background transition-colors"
                                />
                                <p className="text-[13px] text-muted-foreground/80">
                                    {t('settings.profile.displayNameNote', 'This name will be displayed in the system and emails sent to you')}
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Email */}
                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="text-sm font-medium">
                                        {t('settings.profile.email', 'Email')}
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        disabled
                                        className="bg-muted/30 text-muted-foreground border-transparent"
                                    />
                                    <p className="text-[13px] text-muted-foreground/60">
                                        {t('settings.profile.emailNote', 'Email cannot be changed')}
                                    </p>
                                </div>

                                {/* Role */}
                                <div className="grid gap-2">
                                    <Label htmlFor="role" className="text-sm font-medium">
                                        {t('settings.profile.role', 'Role')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="role"
                                            value={formData.role}
                                            disabled
                                            className="bg-muted/30 text-muted-foreground border-transparent pr-10"
                                        />
                                        <div className="absolute right-3 top-2.5 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>
                                    <p className="text-[13px] text-muted-foreground/60">
                                        System role assigned to you
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border/40">
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/user/account-profile');
                                        if (res.ok) {
                                            const data = await res.json();
                                            const dName = data.displayName || session?.user?.name || '';
                                            setFormData({
                                                displayName: dName,
                                                email: data.displayEmail || session?.user?.email || '',
                                                role: 'Host (Owner)',
                                            });
                                            lastSavedNameRef.current = dName;
                                        } else {
                                            const dName = session?.user?.name || '';
                                            setFormData({
                                                displayName: dName,
                                                email: session?.user?.email || '',
                                                role: 'Host (Owner)',
                                            });
                                            lastSavedNameRef.current = dName;
                                        }
                                    } catch {
                                        const dName = session?.user?.name || '';
                                        setFormData({
                                            displayName: dName,
                                            email: session?.user?.email || '',
                                            role: 'Host (Owner)',
                                        });
                                        lastSavedNameRef.current = dName;
                                    }
                                    setHasChanges(false);
                                }}
                                disabled={!hasChanges || isSaving}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-cyan-500 hover:bg-cyan-600 text-white w-full sm:w-auto sm:min-w-[140px] shadow-lg shadow-cyan-500/20"
                                onClick={handleSave}
                                disabled={!hasChanges || isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    t('settings.saveChanges', 'Save Changes')
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Connected Accounts Section */}
                    <div className="grid gap-4 p-4 md:p-6 border border-border/60 rounded-lg bg-card/40 shadow-sm mt-6">
                        <div>
                            <h3 className="text-base md:text-lg font-semibold">Connected Accounts</h3>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                Link multiple login methods to your account
                            </p>
                        </div>

                        {isLoadingAccounts ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Google row */}
                                {(() => {
                                    const googleAcc = connectedAccounts.find(a => a.provider === 'google');
                                    const canDisconnect = connectedAccounts.length > 1;
                                    return (
                                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/50">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <GoogleIcon />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium">Google</div>
                                                    {googleAcc ? (
                                                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                                            Connected
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-muted-foreground">Not connected</div>
                                                    )}
                                                </div>
                                            </div>
                                            {googleAcc ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!canDisconnect || disconnectingProvider === 'google'}
                                                    title={!canDisconnect ? 'Cannot disconnect your only login method' : ''}
                                                    onClick={() => setConfirmDisconnectProvider('google')}
                                                    className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 shrink-0"
                                                >
                                                    {disconnectingProvider === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                                                    <span className="ml-1 hidden sm:inline">Disconnect</span>
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => { window.location.href = '/api/auth/link/google'; }}
                                                    className="shrink-0"
                                                >
                                                    <Link2 className="h-4 w-4" />
                                                    <span className="ml-1 hidden sm:inline">Connect</span>
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Facebook row */}
                                {(() => {
                                    const fbAcc = connectedAccounts.find(a => a.provider === 'facebook');
                                    const canDisconnect = connectedAccounts.length > 1;
                                    return (
                                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/50">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <FacebookIcon />
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium">Facebook</div>
                                                    {fbAcc ? (
                                                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                                            Connected
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-muted-foreground">Not connected</div>
                                                    )}
                                                </div>
                                            </div>
                                            {fbAcc ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!canDisconnect || disconnectingProvider === 'facebook'}
                                                    title={!canDisconnect ? 'Cannot disconnect your only login method' : ''}
                                                    onClick={() => setConfirmDisconnectProvider('facebook')}
                                                    className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 shrink-0"
                                                >
                                                    {disconnectingProvider === 'facebook' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                                                    <span className="ml-1 hidden sm:inline">Disconnect</span>
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                        const res = await fetch('/api/meta/connect?returnTo=profile');
                                                        const data = await res.json();
                                                        if (data.authUrl) window.location.href = data.authUrl;
                                                    }}
                                                    className="shrink-0"
                                                >
                                                    <Link2 className="h-4 w-4" />
                                                    <span className="ml-1 hidden sm:inline">Connect</span>
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Password Change Section */}
                    <div className="grid gap-6 p-4 md:p-6 border border-border/60 rounded-lg bg-card/40 shadow-sm mt-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-base md:text-lg font-semibold">
                                    {hasPassword ? 'Change Password' : 'Set Password'}
                                </h3>
                                <p className="text-xs md:text-sm text-muted-foreground">
                                    {hasPassword
                                        ? 'Update your password to keep your account secure'
                                        : 'Set a password to enable email/password login'}
                                </p>
                            </div>
                            {!showPasswordSection && (
                                <Button
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    onClick={() => setShowPasswordSection(true)}
                                >
                                    {hasPassword ? 'Change Password' : 'Set Password'}
                                </Button>
                            )}
                        </div>

                        {showPasswordSection && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                {/* Current Password - Only show if user has password */}
                                {hasPassword && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="currentPassword" className="text-sm font-medium">
                                            Current Password
                                        </Label>
                                        <Input
                                            id="currentPassword"
                                            type="password"
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            className="max-w-full"
                                        />
                                    </div>
                                )}

                                {/* New Password */}
                                <div className="grid gap-2">
                                    <Label htmlFor="newPassword" className="text-sm font-medium">
                                        New Password
                                    </Label>
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        className="max-w-full"
                                    />
                                    <p className="text-[13px] text-muted-foreground/80">
                                        Must be at least 8 characters long
                                    </p>
                                </div>

                                {/* Confirm Password */}
                                <div className="grid gap-2">
                                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                                        Confirm New Password
                                    </Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        className="max-w-full"
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border/40">
                                    <Button
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            setShowPasswordSection(false);
                                            setPasswordData({
                                                currentPassword: '',
                                                newPassword: '',
                                                confirmPassword: '',
                                            });
                                        }}
                                        disabled={isChangingPassword}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-cyan-500 hover:bg-cyan-600 text-white w-full sm:w-auto sm:min-w-[140px]"
                                        onClick={handlePasswordChange}
                                        disabled={isChangingPassword}
                                    >
                                        {isChangingPassword ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                {hasPassword ? 'Changing...' : 'Setting...'}
                                            </>
                                        ) : (
                                            hasPassword ? 'Update Password' : 'Set Password'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Disconnect Account Confirmation Dialog */}
            <AlertDialog open={!!confirmDisconnectProvider} onOpenChange={(open) => !open && setConfirmDisconnectProvider(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect {confirmDisconnectProvider === 'google' ? 'Google' : 'Facebook'} account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You will no longer be able to sign in with {confirmDisconnectProvider === 'google' ? 'Google' : 'Facebook'}.
                            Make sure you have another way to log in before disconnecting.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmDisconnectProvider && handleDisconnect(confirmDisconnectProvider)}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Disconnect
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Remove Photo Confirmation Dialog */}
            <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove profile photo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove your profile photo? Your initials will be displayed instead.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemovePhoto}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
