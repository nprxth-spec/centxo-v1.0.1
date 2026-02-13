"use client"

import React from "react"
import { getMessage, messages, SupportedLanguage } from "@/lib/messages"

type LanguageContextValue = {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  t: (key: string, fallback?: string) => string
  isReady: boolean
}

const LanguageContext = React.createContext<LanguageContextValue | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<SupportedLanguage>('en')
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('language') : null) as SupportedLanguage | null
    console.log('Initial load - saved language:', saved)
    if (saved && (saved === 'th' || saved === 'en')) {
      setLanguageState(saved)
    }
    setIsReady(true)
  }, [])

  React.useEffect(() => {
    console.log('Language changed to:', language)
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', language)
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = React.useCallback((lang: SupportedLanguage) => {
    console.log('setLanguage called with:', lang)
    setLanguageState(lang)
  }, [])

  const t = React.useCallback((key: string, fallback?: string) => {
    return getMessage(language, key, fallback)
  }, [language])

  const value: LanguageContextValue = React.useMemo(() => ({
    language,
    setLanguage,
    t,
    isReady,
  }), [language, setLanguage, t, isReady])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return ctx
}
