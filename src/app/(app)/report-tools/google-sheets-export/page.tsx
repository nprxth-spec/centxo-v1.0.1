"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Redirect old URL to Ads Manager
export default function GoogleSheetsExportRedirectPage() {
    const router = useRouter()
    useEffect(() => {
        router.replace("/ads-manager/google-sheets-export")
    }, [router])
    return null
}
