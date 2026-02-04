'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function SettingsGeneralPage() {
    const { t } = useLanguage();
    const { data: session } = useSession();
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
    });
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (session?.user) {
            setFormData({
                name: session.user.name || '',
                email: session.user.email || '',
            });
        }
    }, [session]);

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch('/api/user/delete', {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete account');
            }

            toast({
                title: "Account Deleted",
                description: "Your account has been permanently deleted.",
            });

            // Sign out and redirect to home
            await signOut({ callbackUrl: '/' });
        } catch (error) {
            console.error('Error deleting account:', error);
            toast({
                title: "Error",
                description: "Failed to delete account. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">{t('settings.general', 'General Settings')}</h1>
                <p className="text-muted-foreground">{t('settings.generalSubtitle', 'Manage your profile and security preferences')}</p>
            </div>

            {/* Profile Section */}
            <div className="glass-card p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('settings.profile')}</h2>
                <div className="space-y-6">
                    <div>
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">{t('settings.name')}</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="h-12 border-gray-300 bg-white"
                        />
                    </div>
                    <div>
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">{t('settings.email')}</Label>
                        <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="h-12 border-gray-300 bg-white"
                        />
                    </div>
                    <div>
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">Avatar</Label>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <Button variant="outline" className="text-gray-900 border-gray-300 hover:bg-gray-50">
                                Change Avatar
                            </Button>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            {t('settings.saveChanges')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Security Section */}
            <div className="glass-card p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Security Settings</h2>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h3>
                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-900 mb-2 block">Current Password</Label>
                                <Input type="password" className="h-12 border-gray-300 bg-white" />
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-900 mb-2 block">New Password</Label>
                                <Input type="password" className="h-12 border-gray-300 bg-white" />
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-900 mb-2 block">Confirm Password</Label>
                                <Input type="password" className="h-12 border-gray-300 bg-white" />
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            Update Password
                        </Button>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-lg border border-red-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Danger Zone</h2>
                <div className="space-y-6">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h3 className="font-semibold text-red-900 mb-2">Delete Account</h3>
                        <p className="text-sm text-red-700 mb-4">
                            Once you delete your account, there is no going back. Please be certain. This will delete all your campaigns, analytics, and personal data.
                        </p>
                        <Button
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            Delete My Account
                        </Button>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove all your data from our servers including:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>All campaigns and ad sets</li>
                                <li>Analytics and insights data</li>
                                <li>Personal information</li>
                                <li>Connected accounts</li>
                            </ul>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
