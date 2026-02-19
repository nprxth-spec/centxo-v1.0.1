"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import {
    Settings,
    Tag,
    MessageCircle,
    RefreshCw,
    Cloud,
    Wrench,
    Users,
    History,
    Bell,
    ListTodo,
    Layers,
    EyeOff
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";

const menuItems: Array<{ id: string; labelKey: string; descKey: string; icon: ComponentType<{ className?: string }>; badge?: string }> = [
    { id: "general", labelKey: "inbox.settings.menu.general", descKey: "inbox.settings.menu.generalDesc", icon: Settings },
    { id: "tags", labelKey: "inbox.settings.menu.tags", descKey: "inbox.settings.menu.tagsDesc", icon: Tag },
    { id: "reply", labelKey: "inbox.settings.menu.reply", descKey: "inbox.settings.menu.replyDesc", icon: MessageCircle },
    { id: "round-robin", labelKey: "inbox.settings.menu.roundRobin", descKey: "inbox.settings.menu.roundRobinDesc", icon: RefreshCw },
    { id: "sync", labelKey: "inbox.settings.menu.sync", descKey: "inbox.settings.menu.syncDesc", icon: Cloud },
    { id: "tools", labelKey: "inbox.settings.menu.tools", descKey: "inbox.settings.menu.toolsDesc", icon: Wrench },
    { id: "permissions", labelKey: "inbox.settings.menu.permissions", descKey: "inbox.settings.menu.permissionsDesc", icon: Users },
    { id: "history", labelKey: "inbox.settings.menu.history", descKey: "inbox.settings.menu.historyDesc", icon: History },
];

export function InboxSettings() {
    const [activeItem, setActiveItem] = useState("general");
    const { t } = useLanguage();
    const activeMenuLabel = menuItems.find(i => i.id === activeItem)?.labelKey ? t(menuItems.find(i => i.id === activeItem)!.labelKey) : "";

    return (
        <div className="flex flex-col min-h-0 flex-1 w-full max-w-[1440px] mx-auto p-6 md:p-10 pb-20 overflow-hidden">
            <div className="flex flex-col lg:flex-row gap-6 w-full min-w-0 flex-1 min-h-0">
                {/* Left Sidebar */}
                <div className="w-full lg:w-80 flex-shrink-0 space-y-6 min-h-0 lg:min-h-0">
                    <div className="glass-card p-6">
                        <div className="mb-8">
                            <h2 className="text-lg font-bold text-foreground">{t("inbox.settings.title", "Settings")}</h2>
                            <p className="text-xs text-muted-foreground">{t("inbox.settings.subtitle", "Manage chat and automation")}</p>
                        </div>

                        <nav className="space-y-2">
                            {menuItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveItem(item.id)}
                                    className={`w-full flex items-start gap-4 p-3 rounded-lg text-left transition-all ${activeItem === item.id
                                        ? "bg-accent text-accent-foreground"
                                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    <div className={`mt-0.5 p-1.5 rounded-lg ${activeItem === item.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm flex items-center gap-2">
                                            {t(item.labelKey)}
                                            {item.badge && (
                                                <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-bold">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                        {item.descKey && <div className="text-xs text-muted-foreground mt-0.5">{t(item.descKey)}</div>}
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Right Content - card fits viewport, inner content scrolls */}
                <div className="flex-1 min-w-0 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 flex flex-col border border-border rounded-lg bg-card shadow-sm overflow-hidden">
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 md:px-8 lg:px-10 py-6 md:py-8 space-y-6 scrollbar-minimal [scrollbar-gutter:stable]">
                            {activeItem === "general" && <GeneralSettingsContent />}
                            {activeItem !== "general" && (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground min-h-[280px]">
                                    <Wrench className="h-12 w-12 mb-4 opacity-20" />
                                    <h3 className="text-lg font-medium">{t("inbox.settings.comingSoon", "Coming Soon")}</h3>
                                    <p className="text-sm text-center">{t("inbox.settings.comingSoonDesc", "Settings for {name} are under development.").replace(/\{name\}/g, activeMenuLabel)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GeneralSettingsContent() {
    const { t } = useLanguage();
    return (
        <div className="max-w-3xl min-w-0 space-y-8">
            <div>
                <h2 className="text-section-title flex items-center gap-2">
                    <Settings className="w-6 h-6" />
                    {t("inbox.settings.general.title", "General Settings")}
                </h2>
                <p className="text-muted-foreground">{t("inbox.settings.general.subtitle", "Manage your general preferences for Inbox.")}</p>
            </div>

            <Separator />

            <div className="space-y-6">
                <h3 className="font-semibold text-lg">{t("inbox.settings.general.functionsAndTools", "Functions and Tools")}</h3>

                <div className="space-y-6 p-6 border rounded-lg bg-card/50">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Bell className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">{t("inbox.settings.general.browserNotifications", "Browser notifications")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("inbox.settings.general.browserNotificationsDesc", "Receive notifications for new messages")}</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">{t("inbox.settings.general.soundNotification", "Sound notification")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("inbox.settings.general.soundNotificationDesc", "Play a sound when a new message arrives")}</p>
                                </div>
                                <Select defaultValue="default">
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder={t("inbox.settings.general.selectSound", "Select sound")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">{t("inbox.settings.general.soundDefault", "Default")}</SelectItem>
                                        <SelectItem value="chime">{t("inbox.settings.general.soundChime", "Chime")}</SelectItem>
                                        <SelectItem value="none">{t("inbox.settings.general.soundNone", "None")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 p-6 border rounded-lg bg-card/50">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Layers className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">{t("inbox.settings.general.unreadPriority", "Unread Priority")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("inbox.settings.general.unreadPriorityDesc", "Show unread conversations at the top")}</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">{t("inbox.settings.general.afterReading", "After reading")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("inbox.settings.general.afterReadingDesc", "Action to take after reading a message")}</p>
                                </div>
                                <Select defaultValue="next">
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="next">{t("inbox.settings.general.afterReadingNext", "Go to next unread")}</SelectItem>
                                        <SelectItem value="list">{t("inbox.settings.general.afterReadingList", "Back to chat list")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>


                <div className="space-y-6 p-6 border rounded-lg bg-card/50">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <ListTodo className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">{t("inbox.settings.general.taskCompletion", "Task Completion")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("inbox.settings.general.taskCompletionDesc", "Behavior when marking a conversation as done")}</p>
                                </div>
                                <Select defaultValue="close">
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="close">{t("inbox.settings.general.doneClose", "Done & Close")}</SelectItem>
                                        <SelectItem value="stay">{t("inbox.settings.general.doneStay", "Done & Stay")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 p-6 border rounded-lg bg-card/50">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Layers className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">{t("inbox.settings.general.multiImageSending", "Multi-image Sending")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("inbox.settings.general.multiImageSendingDesc", "How multiple images are sent")}</p>
                                </div>
                                <Select defaultValue="group">
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="group">{t("inbox.settings.general.sendAsGroup", "Send as Group")}</SelectItem>
                                        <SelectItem value="separate">{t("inbox.settings.general.sendSeparately", "Send Separately")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <Separator />

            <div className="space-y-6">
                <h3 className="font-semibold text-lg">{t("inbox.settings.general.autoFunctions", "Auto Functions")}</h3>

                <div className="space-y-6 p-6 border rounded-lg bg-card/50">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <EyeOff className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">{t("inbox.settings.general.autoHideComments", "Auto-hide comments")}</Label>
                                    <p className="text-sm text-muted-foreground">{t("inbox.settings.general.autoHideCommentsDesc", "Automatically hide comments on posts")}</p>
                                </div>
                                <Select defaultValue="off">
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="off">{t("inbox.settings.general.off", "Off")}</SelectItem>
                                        <SelectItem value="all">{t("inbox.settings.general.allComments", "All Comments")}</SelectItem>
                                        <SelectItem value="keywords">{t("inbox.settings.general.keywordsOnly", "Keywords only")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
