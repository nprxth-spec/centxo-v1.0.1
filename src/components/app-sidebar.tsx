"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Settings,
    LogOut,
    Megaphone,
    Rocket,
    ChevronRight,
    Layers,
    User,
    Link2,
    Users,
    Palette,
    PanelLeft,
    Sparkles,
    Zap,
    FileSpreadsheet,
    CreditCard,
    MessageCircle,
    MessageSquare,
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState, useEffect } from "react"

import { cn } from "@/lib/utils"
import { signOut } from "next-auth/react"
import { useLanguage } from "@/contexts/LanguageContext"

interface AppSidebarProps {
    isCollapsed: boolean
    toggleSidebar: () => void
    onMobileClose?: () => void
    isMobile?: boolean
}

// Define Navigation Structure
type NavItem = {
    name: string
    href: string
    icon?: any
    iconClass?: string
    translationKey?: string
    isChild?: boolean
}

type NavGroup = {
    label?: string
    items: (NavItem | {
        name: string
        icon: any
        iconClass?: string
        translationKey?: string
        children: NavItem[]
    })[]
}

const navStructure: NavGroup[] = [
    {
        items: [
            { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, iconClass: "text-sky-500", translationKey: 'nav.dashboard' },
            {
                name: "Campaigns",
                icon: Layers,
                iconClass: "text-violet-500",
                translationKey: 'nav.campaigns',
                children: [
                    { name: "Create Ads (Auto)", href: "/create-ads", icon: Rocket, iconClass: "text-amber-500", translationKey: 'nav.createAdsAuto', isChild: true },
                    { name: "Quick Launch", href: "/launch", icon: Rocket, iconClass: "text-green-500", translationKey: 'nav.quickLaunch', isChild: true },
                    { name: "Target Audiences", href: "/audiences", icon: Users, iconClass: "text-indigo-500", translationKey: 'nav.targetAudiences', isChild: true },
                    { name: "A/B Creative Lab", href: "/tools/creative-variants", icon: Sparkles, iconClass: "text-violet-500", translationKey: 'nav.abCreativeLab', isChild: true },
                    { name: "Auto Rules", href: "/tools/auto-rules", icon: Zap, iconClass: "text-amber-500", translationKey: 'tools.autoRules.title', isChild: true },
                ]
            },
            {
                name: "Ads Manager",
                icon: Megaphone,
                iconClass: "text-fuchsia-500",
                translationKey: 'nav.adsManager',
                children: [
                    { name: "Accounts", href: "/ads-manager/accounts", icon: Users, iconClass: "text-indigo-500", translationKey: 'adsManager.accounts', isChild: true },
                    { name: "Campaigns", href: "/ads-manager/campaigns", icon: LayoutDashboard, iconClass: "text-blue-500", translationKey: 'adsManager.campaigns', isChild: true },
                    { name: "AdBox Inbox", href: "/adbox", icon: MessageCircle, iconClass: "text-emerald-500", translationKey: 'nav.adbox', isChild: true },
                    { name: "Manage Comments", href: "/ads-manager/page-posts", icon: MessageSquare, iconClass: "text-orange-500", translationKey: 'nav.manageComments', isChild: true },
                    { name: "Google Sheets Export", href: "/ads-manager/google-sheets-export", icon: FileSpreadsheet, iconClass: "text-green-500", translationKey: 'nav.googleSheetsExport', isChild: true },
                ]
            },
            {
                name: "Settings",
                icon: Settings,
                iconClass: "text-slate-500 dark:text-slate-400",
                translationKey: 'nav.settings',
                children: [
                    { name: "Account", href: "/settings/account", icon: User, iconClass: "text-sky-500", translationKey: 'settings.account', isChild: true },
                    { name: "Billing", href: "/settings/billing", icon: CreditCard, iconClass: "text-amber-500", translationKey: 'settings.billing', isChild: true },
                    { name: "Connections", href: "/settings/connections", icon: Link2, iconClass: "text-blue-500", translationKey: 'settings.connections', isChild: true },
                ]
            },
        ]
    }
]

export default function AppSidebar({ isCollapsed, toggleSidebar, onMobileClose, isMobile = false }: AppSidebarProps) {
    const pathname = usePathname()
    const { t } = useLanguage()
    // Strip locale prefix for navigation comparison
    const pathnameWithoutLocale = pathname.replace(/^\/(en|th)/, '') || '/'

    // State for Collapsed Groups - default all open so they stay open on refresh
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        "Campaigns": true,
        "Ads Manager": true,
        "Settings": true
    })

    // Load state from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('sidebarOpenGroups')
        if (saved) {
            try {
                setOpenGroups(JSON.parse(saved))
            } catch (e) {
                console.error("Failed to parse sidebar state", e)
            }
        }
    }, [])

    const toggleGroup = (groupName: string) => {
        setOpenGroups(prev => {
            const newState = {
                ...prev,
                [groupName]: !prev[groupName]
            }
            try {
                localStorage.setItem('sidebarOpenGroups', JSON.stringify(newState))
            } catch (e) {
                // Ignore write errors
            }
            return newState
        })
    }

    return (
        <div className={cn(
            "flex flex-col h-full overflow-x-hidden",
            "transition-all duration-300 ease-out",
            isCollapsed ? "w-[88px]" : "w-[260px]",
            isMobile ? "bg-card/95 backdrop-blur-xl border-r w-[260px]" : "bg-card border-r border-border"
        )}>
            {/* Sidebar Toggle (Top Right) */}
            <div className={cn(
                "flex items-center h-12 px-3",
                isCollapsed ? "justify-center" : "justify-end"
            )}>
                {!isMobile && (
                    <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-primary transition-colors"
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        <PanelLeft className={cn("h-5 w-5 transition-transform", isCollapsed && "rotate-180")} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <div className={cn(
                "flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-2",
                isCollapsed ? "px-0" : "px-3"
            )}>
                {navStructure.map((group, groupIndex) => (
                    <div key={groupIndex} className={cn(
                        "space-y-0.5",
                        groupIndex > 0 && "pt-2 border-t border-border/30"
                    )}>
                        {/* Group Label */}
                        {!isCollapsed && group.label && (
                            <h4 className="px-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
                                {group.label}
                            </h4>
                        )}

                        <nav className="space-y-1">
                            {group.items.map((item: any, itemIndex) => {
                                // 1. Parent Item with Children
                                if (item.children) {
                                    const isAnyChildActive = item.children.some((child: any) =>
                                        pathnameWithoutLocale === child.href || pathnameWithoutLocale.startsWith(child.href + '/')
                                    )
                                    // Stay open if: saved preference, OR current page is a child (persists on refresh)
                                    const isOpen = openGroups[item.name] ?? isAnyChildActive ?? true

                                    const parentContent = (
                                        <div key={item.name}>
                                            <button
                                                onClick={() => toggleGroup(item.name)}
                                                className={cn(
                                                    "w-full flex items-center justify-between py-2 px-3 text-sm font-medium rounded-lg transition-all group select-none",
                                                    isAnyChildActive ? "bg-secondary text-foreground shadow-md border border-white/5" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                                    isCollapsed && "justify-center px-0 py-2 mx-auto w-10/12"
                                                )}
                                                title={isCollapsed ? item.name : undefined}
                                            >
                                                <div className={cn(
                                                    "flex items-center",
                                                    isCollapsed ? "justify-center gap-1" : "gap-3"
                                                )}>
                                                    <item.icon className={cn("size-4 shrink-0", isAnyChildActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                                    {!isCollapsed && <span className="whitespace-nowrap">{t(item.translationKey, item.name)}</span>}
                                                    {isCollapsed && (
                                                        <ChevronRight className={cn(
                                                            "h-4 w-4 text-muted-foreground/50 transition-transform duration-200 shrink-0",
                                                            isOpen && "rotate-90"
                                                        )} />
                                                    )}
                                                </div>
                                                {!isCollapsed && (
                                                    <ChevronRight className={cn(
                                                        "h-4 w-4 text-muted-foreground/50 transition-transform duration-200",
                                                        isOpen && "rotate-90"
                                                    )} />
                                                )}
                                            </button>

                                            {/* Nested Items — expand downward when open (same when expanded or collapsed) */}
                                            {isOpen && (
                                                isCollapsed ? (
                                                    <div className="mt-1 space-y-0.5">
                                                        {item.children.map((child: any) => {
                                                            const isActive = pathnameWithoutLocale === child.href || pathnameWithoutLocale.startsWith(child.href + '/')
                                                            return (
                                                                <Link
                                                                    key={child.href}
                                                                    href={child.href}
                                                                    onClick={onMobileClose}
                                                                    title={t(child.translationKey, child.name)}
                                                                    className={cn(
                                                                        "flex items-center justify-center py-1.5 px-0 mx-auto w-10/12 rounded-lg transition-colors",
                                                                        isActive
                                                                            ? "text-primary bg-secondary"
                                                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                                    )}
                                                                >
                                                                    {child.icon && <child.icon className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />}
                                                                </Link>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 ml-4 pl-3 border-l border-border/40 space-y-1">
                                                        {item.children.map((child: any) => {
                                                            const isActive = pathnameWithoutLocale === child.href || pathnameWithoutLocale.startsWith(child.href + '/')
                                                            return (
                                                                <Link
                                                                    key={child.href}
                                                                    href={child.href}
                                                                    onClick={onMobileClose}
                                                                    className={cn(
                                                                        "flex items-center gap-3 py-1.5 px-3 text-sm rounded-md transition-colors whitespace-nowrap group",
                                                                        isActive
                                                                            ? "text-primary font-medium"
                                                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                                                    )}
                                                                >
                                                                    {child.icon && <child.icon className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />}
                                                                    <span>{t(child.translationKey, child.name)}</span>
                                                                </Link>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )
                                    return parentContent
                                }

                                // 2. Single Link Item
                                const isActive = pathnameWithoutLocale === item.href || pathnameWithoutLocale.startsWith(item.href + '/')

                                const singleContent = (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onMobileClose}
                                        className={cn(
                                            "flex items-center py-2 px-3 text-sm font-medium rounded-lg transition-all group relative",
                                            isActive
                                                ? "bg-secondary text-foreground shadow-md border border-white/5"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                            isCollapsed && "justify-center px-0 py-2 mx-auto w-10/12"
                                        )}
                                        title={isCollapsed ? item.name : undefined}
                                    >
                                        <div className={cn(
                                            "flex items-center",
                                            isCollapsed ? "justify-center" : "gap-3"
                                        )}>
                                            <item.icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                            {!isCollapsed && <span className="whitespace-nowrap">{t(item.translationKey ?? item.name, item.name)}</span>}
                                        </div>
                                    </Link>
                                )
                                return singleContent
                            })}
                        </nav>
                    </div>
                ))}
            </div>

            {/* Footer / User / Collapse Toggle */}
            <div
                suppressHydrationWarning
                className={cn(
                    "mt-auto border-t border-border/30 mb-6",
                    isCollapsed ? "py-2 px-0" : "p-3"
                )}>
                {!isMobile && (
                    // Toggle button moved to top
                    null
                )}

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            className={cn(
                                "flex items-center w-full py-2 text-sm font-medium text-destructive/80 hover:text-destructive rounded-lg hover:bg-destructive/10 transition-all",
                                isCollapsed ? "justify-center px-0" : "px-3 gap-4"
                            )}
                            title={isCollapsed ? t('header.logout', 'Log out') : undefined}
                            suppressHydrationWarning
                        >
                            <LogOut className="h-5 w-5 text-red-500" />
                            {!isCollapsed && <span className="whitespace-nowrap">{t('header.logout', 'Log out')}</span>}
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('header.logout.title', 'Are you sure you want to log out?')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('header.logout.desc', 'You will be redirected to the login page.')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('header.logout.cancel', 'Cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {t('header.logout.confirm', 'Log out')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div >
    )
}
