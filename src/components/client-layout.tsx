"use client"

import { useState, useEffect } from "react"
import AppSidebar from "@/components/app-sidebar"
import AppHeader from "@/components/app-header"
import { cn } from "@/lib/utils"

// Force re-compile to clear stash cache

interface ClientLayoutProps {
    children: React.ReactNode
    defaultCollapsed?: boolean
}

export default function ClientLayout({ children, defaultCollapsed = false }: ClientLayoutProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // Sync with valid cookie on mount if needed, but rely on defaultCollapsed for initial render
    useEffect(() => {
        // Optional: Keep localStorage as backup or legacy support?
        // Better to just stick to one source of truth -> Cookie
    }, [])

    const toggleSidebar = () => {
        const newState = !isCollapsed
        setIsCollapsed(newState)
        document.cookie = `sidebar:state=${newState}; path=/; max-age=31536000` // 1 year
    }

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen)
    }

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false)
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background relative selection:bg-primary/20">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Mobile Sidebar */}
            <div className={cn(
                "fixed md:hidden z-50 h-full",
                "transition-transform duration-300 ease-out",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <AppSidebar
                    isCollapsed={false}
                    toggleSidebar={toggleSidebar}
                    onMobileClose={closeMobileMenu}
                    isMobile={true}
                />
            </div>

            {/* Header - Top Full Width */}
            <AppHeader onMobileMenuToggle={toggleMobileMenu} isCollapsed={isCollapsed} />

            {/* Main Layout: Sidebar (Left) + Content (Right) */}
            <div className="flex flex-1 overflow-hidden relative z-10">

                {/* Desktop Sidebar */}
                <div className="hidden md:block z-30 relative h-full">
                    <AppSidebar
                        isCollapsed={isCollapsed}
                        toggleSidebar={toggleSidebar}
                    />
                </div>

                {/* Main Content Area */}
                <main
                    suppressHydrationWarning
                    className="flex-1 overflow-y-auto scrollbar-minimal bg-background relative"
                >
                    <div className="min-h-full flex flex-col">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
