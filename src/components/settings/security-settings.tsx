'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Key, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SecuritySettings() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [hasPassword, setHasPassword] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: '',
    });

    // Check if user has password
    useEffect(() => {
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
    }, []);

    const handlePasswordUpdate = async () => {
        // Validation
        if (!passwords.new) {
            toast({
                title: "Error",
                description: "Please enter a new password",
                variant: "destructive",
            });
            return;
        }

        if (passwords.new.length < 8) {
            toast({
                title: "Error",
                description: "Password must be at least 8 characters",
                variant: "destructive",
            });
            return;
        }

        if (passwords.new !== passwords.confirm) {
            toast({
                title: "Error",
                description: "Passwords do not match",
                variant: "destructive",
            });
            return;
        }

        if (hasPassword && !passwords.current) {
            toast({
                title: "Error",
                description: "Please enter your current password",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword: passwords.current,
                    newPassword: passwords.new,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update password');
            }

            toast({
                title: "Success",
                description: data.message || "Password updated successfully",
            });

            // Reset form
            setPasswords({
                current: '',
                new: '',
                confirm: '',
            });

            // Update hasPassword state if it was set for the first time
            if (!hasPassword) {
                setHasPassword(true);
            }
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update password",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (hasPassword === null) {
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

            {/* Change/Set Password Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">
                        {hasPassword ? t('settings.password.change', 'Change Password') : t('settings.password.set', 'Set Password')}
                    </h3>
                </div>

                {!hasPassword && (
                    <Alert className="ml-7">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {t('settings.password.setMsg', 'You signed in with Google. Set a password to enable email/password login while keeping your Google account connected.')}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4 pl-7">
                    {hasPassword && (
                        <div className="space-y-2">
                            <Label htmlFor="current-password">{t('settings.password.current', 'Current Password')}</Label>
                            <Input
                                id="current-password"
                                type="password"
                                value={passwords.current}
                                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                className="max-w-md"
                                disabled={loading}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="new-password">{t('settings.password.new', 'New Password')}</Label>
                        <Input
                            id="new-password"
                            type="password"
                            value={passwords.new}
                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                            className="max-w-md"
                            placeholder="At least 8 characters"
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">{t('settings.password.confirm', 'Confirm New Password')}</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={passwords.confirm}
                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                            className="max-w-md"
                            disabled={loading}
                        />
                    </div>

                    <Button
                        className="mt-4"
                        onClick={handlePasswordUpdate}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            hasPassword ? t('settings.password.update', 'Update Password') : t('settings.password.set', 'Set Password')
                        )}
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Two-Factor Authentication */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">{t('settings.2fa.title', 'Two-Factor Authentication')}</h3>
                </div>

                <div className="pl-7">
                    <p className="text-sm text-muted-foreground mb-4">
                        {t('settings.2fa.desc', 'Add an extra layer of security to your account by enabling two-factor authentication.')}
                    </p>
                    <Button variant="outline" disabled>
                        {t('settings.2fa.enable', 'Enable 2FA')} ({t('settings.comingSoon', 'Coming Soon')})
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Active Sessions */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('settings.sessions.title', 'Active Sessions')}</h3>
                <div className="pl-7">
                    <p className="text-sm text-muted-foreground mb-4">
                        {t('settings.sessions.desc', 'Manage and log out your active sessions on other browsers and devices.')}
                    </p>
                    <Button variant="outline" className="text-destructive hover:text-destructive" disabled>
                        {t('settings.sessions.logout', 'Log Out Other Sessions')} ({t('settings.comingSoon', 'Coming Soon')})
                    </Button>
                </div>
            </div>
        </div>
    );
}
