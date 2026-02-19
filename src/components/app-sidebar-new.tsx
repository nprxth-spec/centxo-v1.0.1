"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Home,
    Megaphone,
    PlusCircle,
    Settings,
    MessageCircle,
    Wrench,
    ChevronRight,
} from 'lucide-react';

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"

// Navigation items grouped for centxo.online style
const navGroups = [
    {
        label: "Main",
        items: [
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
        ]
    },
    {
        label: "Ads & Tools",
        items: [
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
        ]
    },
    {
        label: "System",
        items: [
            {
                name: "Settings",
                href: "/settings",
                icon: Settings,
                translationKey: 'nav.settings'
            },
        ]
    }
]

export default function AppSidebar() {
    const pathname = usePathname()
    const { t } = useLanguage()
    const pathnameWithoutLocale = pathname.replace(/^\/(en|th)/, '') || '/'

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
        <Sidebar collapsible="icon" className="border-r border-border bg-background/95 backdrop-blur-xl">
            <SidebarHeader className="h-16 flex items-center px-4 border-b border-border/50">
                <Link href="/home" className="flex items-center gap-2">
                    <img src="/centxo-logo.png" alt="Centxo" className="size-8 rounded-lg shrink-0" />
                    <span className="font-outfit font-bold text-xl tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
                        Centxo
                    </span>
                </Link>
            </SidebarHeader>
            <SidebarContent className="py-2">
                {navGroups.map((group) => (
                    <SidebarGroup key={group.label} className="py-2">
                        <SidebarGroupLabel className="px-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em] mb-1 group-data-[collapsible=icon]:hidden">
                            {group.label}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.items.map((item) => {
                                    const active = isActive(item.href)
                                    return (
                                        <SidebarMenuItem key={item.href} className="px-2">
                                            <SidebarMenuButton
                                                asChild
                                                isActive={active}
                                                tooltip={t(item.translationKey, item.name)}
                                                className={cn(
                                                    "transition-all duration-200 h-10 px-3",
                                                    active
                                                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold"
                                                        : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <Link href={item.href} className="flex items-center gap-3 w-full">
                                                    <item.icon className={cn(
                                                        "size-4.5 shrink-0",
                                                        active ? "stroke-[2.5]" : "stroke-[1.5]"
                                                    )} />
                                                    <span className="group-data-[collapsible=icon]:hidden truncate">
                                                        {t(item.translationKey, item.name)}
                                                    </span>
                                                    {active && (
                                                        <ChevronRight className="ml-auto size-3.5 group-data-[collapsible=icon]:hidden opacity-70" />
                                                    )}
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    )
}
