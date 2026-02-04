'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function GeneralSettings() {
    const { t } = useLanguage();
    const { data: session } = useSession();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
    });

    useEffect(() => {
        if (session?.user) {
            setFormData({
                name: session.user.name || '',
                email: session.user.email || '',
            });
        }
    }, [session]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                    {t('settings.general', 'General Settings')}
                </h2>
                <p className="text-muted-foreground">
                    {t('settings.generalSubtitle', 'Manage your profile and security preferences')}
                </p>
            </div>

            {/* Profile Section */}
            <div className="glass-card p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    {t('settings.profile', 'Profile')}
                </h3>
                <div className="space-y-6">
                    <div>
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">
                            {t('settings.name', 'Name')}
                        </Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="h-12 border-gray-300 bg-white"
                        />
                    </div>
                    <div>
                        <Label className="text-sm font-medium text-gray-900 mb-2 block">
                            {t('settings.email', 'Email')}
                        </Label>
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
                            {t('settings.saveChanges', 'Save Changes')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Security Section */}
            <div className="glass-card p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Security Settings</h3>
                <div className="space-y-6">
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h4>
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
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Danger Zone</h3>
                <div className="space-y-6">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h4 className="font-semibold text-red-900 mb-2">Delete Account</h4>
                        <p className="text-sm text-red-700 mb-4">
                            Once you delete your account, there is no going back. Please be certain. This will delete all your campaigns, analytics, and personal data.
                        </p>
                        <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white">
                            Delete My Account
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
