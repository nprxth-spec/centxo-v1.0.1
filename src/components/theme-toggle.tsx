"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <div className="relative inline-flex h-6 w-12 items-center rounded-full bg-gray-200 border border-gray-300">
                <div className="flex w-full items-center justify-around px-0.5">
                    <Sun className="h-3 w-3 text-gray-400" />
                    <Moon className="h-3 w-3 text-gray-400" />
                </div>
            </div>
        )
    }

    const isDark = theme === 'dark'

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border ${
                isDark 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-gray-100 border-gray-300'
            }`}
            aria-label="Toggle theme"
        >
            {/* Background highlight */}
            <span
                className={`absolute top-0.5 h-5 w-5 rounded-full transition-all duration-300 ${
                    isDark 
                        ? 'left-6 bg-gray-700' 
                        : 'left-0.5 bg-white shadow-sm'
                }`}
            />
            
            {/* Icons */}
            <div className="relative flex w-full items-center justify-around px-0.5 z-10">
                <Sun className={`h-3 w-3 transition-colors ${
                    isDark ? 'text-gray-500' : 'text-orange-500'
                }`} />
                <Moon className={`h-3 w-3 transition-colors ${
                    isDark ? 'text-blue-300' : 'text-gray-400'
                }`} />
            </div>
        </button>
    )
}