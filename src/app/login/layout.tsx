import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen w-full relative flex flex-col bg-background overflow-hidden">
            {/* Animated gradient background - same as centxo-v1.0.0 */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-50 w-full backdrop-blur-sm">
                <div className="container flex h-16 items-center justify-between px-4 sm:px-8">
                    <Link href="/" className="flex items-center gap-2 group">
                        <img src="/centxo-logo.png" alt="Centxo" className="w-8 h-8 rounded-lg group-hover:scale-105 transition-transform" />
                        <span className="font-bold text-xl hidden sm:inline-block">Centxo</span>
                    </Link>

                    <ThemeToggle />
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-6 relative z-10 w-full animate-in fade-in zoom-in-95 duration-500">
                {children}
            </main>
        </div>
    );
}
