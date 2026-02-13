"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Home,
    Megaphone,
    PlusCircle,
    Settings,
    PanelLeft,
    MessageCircle,
    Wrench,
} from 'lucide-react';

import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"

interface AppSidebarProps {
    isCollapsed: boolean
    toggleSidebar: () => void
    onMobileClose?: () => void
    isMobile?: boolean
}

// Navigation - 6 items for easy access
const navItems = [
    { 
        name: "Home", 
        href: "/home", 
        icon: Home, 
        translationKey: 'nav.home' 
    },
    { 
        name: "Inbox", 
        href: "/inbox", 
        icon: MessageCircle, 
        translationKey: 'nav.inbox' 
    },
    { 
        name: "Ads", 
        href: "/ads", 
        icon: Megaphone, 
        translationKey: 'nav.ads' 
    },
    { 
        name: "Create", 
        href: "/create", 
        icon: PlusCircle, 
        translationKey: 'nav.create' 
    },
    { 
        name: "Tools", 
        href: "/tools", 
        icon: Wrench, 
        translationKey: 'nav.tools' 
    },
    { 
        name: "Settings", 
        href: "/settings", 
        icon: Settings, 
        translationKey: 'nav.settings' 
    },
]

export default function AppSidebar({ isCollapsed, toggleSidebar, onMobileClose, isMobile = false }: AppSidebarProps) {
    const pathname = usePathname()
    const { t } = useLanguage()
    // Strip locale prefix for navigation comparison
    const pathnameWithoutLocale = pathname.replace(/^\/(en|th)/, '') || '/'

    // Check if path is active (exact match or starts with for sub-paths)
    const isActive = (href: string) => {
        if (href === '/home') {
            return pathnameWithoutLocale === '/home' || pathnameWithoutLocale === '/dashboard'
        }
        if (href === '/inbox') {
            return pathnameWithoutLocale === '/inbox' || pathnameWithoutLocale.startsWith('/inbox/')
        }
        if (href === '/tools') {
            return pathnameWithoutLocale === '/tools' || 
                   pathnameWithoutLocale.startsWith('/tools/') ||
                   pathnameWithoutLocale === '/audiences'
        }
        return pathnameWithoutLocale === href || pathnameWithoutLocale.startsWith(href + '/')
    }

    return (
        <div className={cn(
            "flex flex-col h-full overflow-x-hidden transition-all duration-300 ease-out bg-card/95 backdrop-blur-xl border-r border-border",
            isCollapsed ? "w-[72px]" : "w-[220px]",
            isMobile && "w-[220px]"
        )}>
            {/* Navigation - active = solid rounded block; inactive on glass */}
            <nav className={cn(
                "flex-1 overflow-y-auto overflow-x-hidden pt-4",
                isCollapsed ? "px-2" : "px-3"
            )}>
                <div className="space-y-1">
                    {navItems.map((item) => {
                        const active = isActive(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onMobileClose}
                                className={cn(
                                    "flex items-center py-2.5 px-3 text-sm font-medium rounded-lg transition-all group relative",
                                    active
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "text-muted-foreground hover:bg-white/20 dark:hover:bg-white/5 hover:text-foreground",
                                    isCollapsed && "justify-center px-2"
                                )}
                                title={isCollapsed ? t(item.translationKey, item.name) : undefined}
                            >
                                <div className={cn(
                                    "flex items-center",
                                    isCollapsed ? "justify-center" : "gap-3"
                                )}>
                                    <item.icon className={cn(
                                        "size-5 shrink-0",
                                        active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                                    )} />
                                    {!isCollapsed && (
                                        <span className="whitespace-nowrap">
                                            {t(item.translationKey, item.name)}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* Sidebar Toggle (Bottom) - rounded, soft shadow */}
            {!isMobile && (
                <div className={cn(
                    "flex items-center border-t border-border py-3 px-3",
                    isCollapsed ? "justify-center" : "justify-end"
                )}>
                    <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-xl text-muted-foreground hover:bg-white/20 dark:hover:bg-white/5 hover:text-primary transition-colors shadow-sm"
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        <PanelLeft className={cn("h-5 w-5 transition-transform", isCollapsed && "rotate-180")} />
                    </button>
                </div>
            )}
        </div>
    )
}
