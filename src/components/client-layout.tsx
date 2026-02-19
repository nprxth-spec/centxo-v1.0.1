import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import AppSidebar from "@/components/app-sidebar"
import AppHeader from "@/components/app-header"
import { cn } from "@/lib/utils"

interface ClientLayoutProps {
    children: React.ReactNode
    defaultCollapsed?: boolean
}

export default function ClientLayout({ children, defaultCollapsed = false }: ClientLayoutProps) {
    return (
        <SidebarProvider defaultOpen={!defaultCollapsed}>
            <div className="flex h-screen w-full overflow-hidden bg-background relative selection:bg-primary/20">
                <AppSidebar />
                <SidebarInset className="flex flex-col flex-1 overflow-hidden relative">
                    <AppHeader />
                    <main
                        suppressHydrationWarning
                        className="flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto scrollbar-minimal bg-background relative"
                    >
                        <div className="min-h-full min-w-0 flex flex-col p-3 md:p-4">
                            {children}
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    )
}
