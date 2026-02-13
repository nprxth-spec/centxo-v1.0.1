'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export function NotificationsSettings() {
    const { t } = useLanguage();
    const [notifications, setNotifications] = useState({
        emailNotifications: true,
        campaignUpdates: true,
        weeklyReports: false,
        systemAlerts: true,
        marketingEmails: false,
    });

    return (
        <div className="space-y-6">
            {/* Header removed - moved to layout */}

            {/* Notification Settings */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="email-notifications" className="text-base font-medium">
                            {t('settings.notifications.email', 'Email Notifications')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.notifications.emailDesc', 'Receive notifications via email')}
                        </p>
                    </div>
                    <Switch
                        id="email-notifications"
                        checked={notifications.emailNotifications}
                        onCheckedChange={(checked) =>
                            setNotifications({ ...notifications, emailNotifications: checked })
                        }
                    />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="campaign-updates" className="text-base font-medium">
                            {t('settings.notifications.campaign', 'Campaign Updates')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.notifications.campaignDesc', 'Get notified about campaign performance changes')}
                        </p>
                    </div>
                    <Switch
                        id="campaign-updates"
                        checked={notifications.campaignUpdates}
                        onCheckedChange={(checked) =>
                            setNotifications({ ...notifications, campaignUpdates: checked })
                        }
                    />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="weekly-reports" className="text-base font-medium">
                            {t('settings.notifications.weekly', 'Weekly Reports')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.notifications.weeklyDesc', 'Receive weekly performance summaries')}
                        </p>
                    </div>
                    <Switch
                        id="weekly-reports"
                        checked={notifications.weeklyReports}
                        onCheckedChange={(checked) =>
                            setNotifications({ ...notifications, weeklyReports: checked })
                        }
                    />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="system-alerts" className="text-base font-medium">
                            {t('settings.notifications.system', 'System Alerts')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.notifications.systemDesc', 'Important system and security notifications')}
                        </p>
                    </div>
                    <Switch
                        id="system-alerts"
                        checked={notifications.systemAlerts}
                        onCheckedChange={(checked) =>
                            setNotifications({ ...notifications, systemAlerts: checked })
                        }
                    />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="marketing-emails" className="text-base font-medium">
                            {t('settings.notifications.marketing', 'Marketing Emails')}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.notifications.marketingDesc', 'Receive tips, news, and product updates')}
                        </p>
                    </div>
                    <Switch
                        id="marketing-emails"
                        checked={notifications.marketingEmails}
                        onCheckedChange={(checked) =>
                            setNotifications({ ...notifications, marketingEmails: checked })
                        }
                    />
                </div>
            </div>
        </div>
    );
}
