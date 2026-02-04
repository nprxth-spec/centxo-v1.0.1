"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Redirect legacy export-sheet URL to Ads Manager
export default function ExportSheetRedirectPage() {
    const router = useRouter()
    useEffect(() => {
        router.replace("/ads-manager/google-sheets-export")
    }, [router])
    return null
}
