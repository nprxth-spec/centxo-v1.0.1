"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Menu, LogOut, Sparkles, User } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { useLanguage } from "@/contexts/LanguageContext"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { ManageAccessMenu } from "@/components/ManageAccessMenu"
import { toast } from "@/hooks/use-toast"

interface AppHeaderProps {
    onMobileMenuToggle?: () => void
    isCollapsed?: boolean
}

export default function AppHeader({ onMobileMenuToggle, isCollapsed = false }: AppHeaderProps) {
    const { data: session } = useSession()
    const { t, language } = useLanguage()
    const user = session?.user
    const pathname = usePathname()

    // Determine if we should use the split border style
    // If we are in settings (*), we use full dashed or full solid?
    // User said: "For pages OTHER than settings, make it dashed ONLY for sidebar portion"
    // implies: On Settings page, keep it as is (which was full dashed from previous step).
    const searchParams = useSearchParams()

    // Check if we are on the inbox page
    const isAdBoxPage = pathname?.startsWith('/inbox')
    const activeTab = searchParams.get('tab') || 'chat'

    // When on /inbox?tab=settings we have no slug in URL; use last saved slug so Chat link returns to single page
    const [chatHref, setChatHref] = useState(pathname && pathname !== '/inbox' ? pathname : '/inbox/multi_pages')
    useEffect(() => {
        if (pathname && pathname !== '/inbox') {
            setChatHref(pathname)
        } else if (pathname === '/inbox' && typeof window !== 'undefined') {
            const last = sessionStorage.getItem('inbox_last_slug')
            setChatHref(last ? `/inbox/${last}` : '/inbox/multi_pages')
        }
    }, [pathname])

    // Determine if we should use the split border style
    const isSettingsPage = pathname?.startsWith('/settings') || pathname?.startsWith('/account')

    const sidebarWidth = isCollapsed ? 72 : 220

    return (
        <header className="relative flex items-center justify-between h-16 px-4 md:px-8 z-20 sticky top-0 bg-card/95 backdrop-blur-xl">
            {/* Split border: dashed over sidebar, solid over content (v1.0.1) */}
            {!isSettingsPage && (
                <div className="absolute bottom-0 left-0 right-0 flex pointer-events-none">
                    <div className="flex-shrink-0 border-b border-dashed border-border" style={{ width: sidebarWidth }} />
                    <div className="flex-1 border-b border-border" />
                </div>
            )}
            {isSettingsPage && (
                <div className="absolute bottom-0 left-0 right-0 border-b border-dashed border-border pointer-events-none" />
            )}

            <div className="flex items-center gap-4 relative z-10">
                {/* Mobile Menu Button */}
                {onMobileMenuToggle && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden text-foreground hover:bg-accent"
                        onClick={onMobileMenuToggle}
                    >
                        <Menu className="h-6 w-6" />
                    </Button>
                )}

                {/* Logo */}
                <Link href="/home" className="flex items-center gap-2 md:mr-8">
                    <img src="/centxo-logo.png" alt="Centxo" className="w-8 h-8 rounded-lg" />
                    <span className="font-outfit font-bold text-xl tracking-tight text-foreground hidden md:block">Centxo</span>
                </Link>

                {/* AdBox Left Navigation */}
                {isAdBoxPage && (
                    <div className="flex items-center gap-1 ml-32">
                        <Link
                            href={chatHref}
                            className={cn(
                                "flex items-center justify-center w-24 py-2 text-sm font-medium rounded-md transition-all",
                                activeTab === 'chat'
                                    ? "text-foreground font-bold bg-accent/50"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                            )}
                        >
                            Chat
                        </Link>
                        <Link
                            href={`${chatHref}?tab=statistics`}
                            className={cn(
                                "flex items-center justify-center w-24 py-2 text-sm font-medium rounded-md transition-all",
                                activeTab === 'statistics'
                                    ? "text-foreground font-bold bg-accent/50"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                            )}
                        >
                            Statistics
                        </Link>
                        <Link
                            href="/inbox?tab=settings"
                            className={cn(
                                "flex items-center justify-center w-24 py-2 text-sm font-medium rounded-md transition-all",
                                activeTab === 'settings'
                                    ? "text-foreground font-bold bg-accent/50"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                            )}
                        >
                            Settings
                        </Link>
                    </div>
                )}
            </div>


            <div className="flex items-center space-x-3 sm:space-x-4 relative z-10">
                <LanguageToggle />

                <ThemeToggle />

                <div className="h-8 w-[1px] bg-border hidden sm:block" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-accent/50 transition-colors">
                            <Avatar className="h-10 w-10 border-2 border-white dark:border-zinc-800 shadow-sm">
                                <AvatarImage src={user?.image || ""} alt={user?.name || ""} referrerPolicy="no-referrer" />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">{user?.name?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 p-2 glass-card border-none" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal p-2">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-semibold leading-none">{user?.name || 'User'}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email || ''}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-border/50" />

                        <DropdownMenuItem asChild className="rounded-lg cursor-pointer focus:bg-primary/10 focus:text-primary">
                            <Link href="/settings" className="flex items-center w-full py-2">
                                <User className="mr-2 h-4 w-4 text-sky-500" />
                                <span>{t('settings.accountSettings', 'Account Settings')}</span>
                            </Link>
                        </DropdownMenuItem>

                        <ManageAccessMenu />

                        <DropdownMenuSeparator className="bg-border/50" />
                        <DropdownMenuItem
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="rounded-lg cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive py-2"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>{t('header.logout', 'Log out')}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header >
    )
}
