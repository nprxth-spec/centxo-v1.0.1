"use client"

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
import { Menu, LogOut, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { useLanguage } from "@/contexts/LanguageContext"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

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
    const isSettingsPage = pathname?.startsWith('/settings')

    // Sidebar width based on collapsed state (matches app-sidebar.tsx)
    const sidebarWidth = isCollapsed ? '88px' : '260px'

    return (
        <header className={cn(
            "flex items-center justify-between h-16 px-4 md:px-8 z-20 sticky top-0 bg-card",
            // Base border logic:
            // If settings page: use full dashed border (as per recent "okay")
            // If other pages: NO base border (we will draw it manually with divs)
            isSettingsPage ? "border-b border-dashed border-border" : "relative border-b-0"
        )}>
            {/* Custom Split Border for Non-Settings Pages */}
            {!isSettingsPage && (
                <>
                    {/* Sidebar Portion: Dashed */}
                    <div
                        className="absolute bottom-0 left-0 h-[1px] border-b border-dashed border-border transition-all duration-300 ease-out"
                        style={{ width: sidebarWidth }}
                    />
                    {/* Content Portion: Solid */}
                    <div
                        className="absolute bottom-0 right-0 h-[1px] bg-border transition-all duration-300 ease-out"
                        style={{ left: sidebarWidth }}
                    />
                </>
            )}

            <div className="flex items-center gap-4">
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
                <Link href="/dashboard" className="flex items-center gap-2 md:mr-8">
                    <img src="/centxo-logo.png" alt="Centxo" className="w-8 h-8 rounded-xl" />
                    <span className="font-outfit font-bold text-xl tracking-tight text-foreground hidden md:block">Centxo</span>
                </Link>
            </div>

            <div className="flex items-center space-x-3 sm:space-x-6">
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
                            <Link href="/pricing" className="flex items-center w-full py-2">
                                <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                                <span>{language === 'th' ? 'อัปเกรด' : 'Upgrade'}</span>
                            </Link>
                        </DropdownMenuItem>
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
