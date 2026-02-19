"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Settings,
    LayoutDashboard,
    MessageSquare,
    Rocket,
    BarChart3,
    Wrench,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"

export default function AppSidebar() {
    const pathname = usePathname()
    const { t } = useLanguage()
    const { toggleSidebar } = useSidebar()
    const pathnameWithoutLocale = pathname.replace(/^\/(en|th)/, '') || '/'

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathnameWithoutLocale === '/dashboard' || pathnameWithoutLocale === '/home'
        }
        if (href === '/tools') {
            return pathnameWithoutLocale === '/tools' || pathnameWithoutLocale.startsWith('/tools/')
        }
        return pathnameWithoutLocale === href || pathnameWithoutLocale.startsWith(href + '/')
    }

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Ads Manager", href: "/ads-manager", icon: BarChart3 },
        { name: "Create Ads", href: "/create", icon: Rocket },
        { name: "Inbox", href: "/inbox", icon: MessageSquare },
        { name: "Tools", href: "/tools", icon: Wrench },
    ]


    return (
        <Sidebar collapsible="icon" className="border-r border-border bg-card/95 backdrop-blur-xl transition-all duration-300 ease-in-out [&_[data-sidebar=sidebar]]:!bg-card/95 [&_[data-sidebar=sidebar]]:backdrop-blur-xl">
            <SidebarHeader className="h-16 flex flex-row items-center justify-center px-4 group-data-[collapsible=icon]:px-2" />

            <SidebarContent className="px-3 py-4 space-y-2 group-data-[collapsible=icon]:px-2">
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu className="space-y-1">
                            {navItems.map((item) => {
                                const active = isActive(item.href)
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={active}
                                            tooltip={item.name}
                                            className={cn(
                                                "h-10 transition-all rounded-lg",
                                                active
                                                    ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                            )}
                                        >
                                            <Link href={item.href} className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
                                                <item.icon className={cn("size-4.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                                                <span className="text-sm group-data-[collapsible=icon]:hidden">{item.name}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathnameWithoutLocale.startsWith('/settings')}
                                    tooltip="Settings"
                                    className={cn(
                                        "h-10 transition-all rounded-lg",
                                        pathnameWithoutLocale.startsWith('/settings')
                                            ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                    )}
                                >
                                    <Link href="/settings" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
                                        <Settings className={cn("size-4.5 shrink-0", pathnameWithoutLocale.startsWith('/settings') ? "text-primary" : "text-muted-foreground")} />
                                        <span className="text-sm group-data-[collapsible=icon]:hidden">Settings</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-3 border-t border-border/50 group-data-[collapsible=icon]:p-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={toggleSidebar}
                            className={cn(
                                "h-10 w-full text-muted-foreground hover:bg-accent/50 hover:text-foreground rounded-lg transition-all",
                                "group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:rounded-md"
                            )}
                            tooltip="Toggle sidebar"
                        >
                            {/* ใช้ CSS แทน state conditional เพื่อป้องกัน hydration mismatch */}
                            <PanelLeftOpen className="size-5 shrink-0 mx-auto hidden group-data-[collapsible=icon]:block" />
                            <PanelLeftClose className="size-5 shrink-0 group-data-[collapsible=icon]:hidden" />
                            <span className="group-data-[collapsible=icon]:hidden font-medium ml-2">
                                Collapse
                            </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
