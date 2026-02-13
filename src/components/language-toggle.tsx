"use client"

import * as React from "react"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/contexts/LanguageContext"

export function LanguageToggle() {
    const { language, setLanguage, isReady, t } = useLanguage()

    if (!isReady) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
                <Globe className="h-4 w-4" />
                <span className="sr-only">Change language</span>
            </Button>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Globe className="h-4 w-4" />
                    <span className="sr-only">Change language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem 
                    onClick={() => {
                        console.log('Clicking TH language option');
                        setLanguage('th');
                    }}
                    className={language === 'th' ? 'bg-primary/10 text-primary' : ''}
                >
                    <span className="mr-2">TH</span>
                    <span>{t('language.th', 'Thai')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                    onClick={() => {
                        console.log('Clicking EN language option');
                        setLanguage('en');
                    }}
                    className={language === 'en' ? 'bg-primary/10 text-primary' : ''}
                >
                    <span className="mr-2">EN</span>
                    <span>{t('language.en', 'English')}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
