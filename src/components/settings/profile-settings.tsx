'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

export function ProfileSettings() {
    const { t } = useLanguage();
    const { data: session, update } = useSession();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        role: '',
    });
    const [profileImage, setProfileImage] = useState<string>('');
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

    useEffect(() => {
        if (session?.user) {
            setFormData({
                displayName: session.user.name || '',
                email: session.user.email || '',
                role: 'Host (Owner)',
            });
            setProfileImage(session.user.image || '');

            // Check if user has password
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
        setHasChanges(value !== session?.user?.name);
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
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">{t('settings.accountSettings', 'Account Settings')}</h2>
                <p className="text-sm md:text-base text-muted-foreground">
                    {t('settings.accountSubtitle', 'Manage your account information and preferences')}
                </p>
            </div>
            <div className="my-6 h-[1px] bg-border" />

            <div className="grid gap-6 lg:grid-cols-12 items-start">
                {/* Side Column: Profile Picture Card */}
                <div className="lg:col-span-4">
                    <div className="flex flex-col items-center text-center gap-4 md:gap-6 p-4 md:p-6 border border-border/60 rounded-2xl bg-card/40 shadow-sm">
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
                    <div className="grid gap-6 md:gap-8 p-4 md:p-8 border border-border/60 rounded-2xl bg-card/40 shadow-sm">
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
                                onClick={() => {
                                    setFormData({
                                        displayName: session?.user?.name || '',
                                        email: session?.user?.email || '',
                                        role: 'Host (Owner)',
                                    });
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

                    {/* Password Change Section */}
                    <div className="grid gap-6 p-4 md:p-6 border border-border/60 rounded-2xl bg-card/40 shadow-sm mt-6">
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
