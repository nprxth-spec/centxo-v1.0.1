"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Redirect report-tools to Ads Manager Google Sheets Export
export default function ReportToolsRedirectPage() {
    const router = useRouter()
    useEffect(() => {
        router.replace("/ads?tab=export")
    }, [router])
    return null
}
