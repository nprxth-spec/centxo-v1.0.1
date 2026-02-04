"use client"

import { useState, useEffect, useCallback } from "react"

import { useSession } from "next-auth/react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
    FileSpreadsheet,
    Loader2,
    Settings2,
    Trash2,
} from "lucide-react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
// Ensure Calendar component exists - usually it is in components/ui/calendar
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
// Tabs imports if needed (though used in page, maybe used here too?)
// Original code used Tabs?
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { translations } from "./export-feature-translations"
import { useLanguage } from "@/contexts/LanguageContext"
import { useConfig } from "@/contexts/AdAccountContext"

export interface ExportConfig {
    id?: string
    name: string
    spreadsheetUrl: string
    spreadsheetName?: string
    sheetName: string
    dataType: string
    columnMapping: Record<string, string>
    autoExportEnabled: boolean
    exportFrequency: string | null
    exportHour: number | null
    exportMinute: number | null
    exportInterval: number | null
    appendMode: boolean
    includeDate: boolean
    accountIds: string[]
    adAccountTimezone?: string | null
    useAdAccountTimezone: boolean
    lastExportAt?: string
    lastExportStatus?: string
}

interface GoogleSheetsConfigContentProps {
    dataType: string // accounts, campaigns, adsets, ads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>[] // Made optional for standalone
    onClose?: () => void
    standalone?: boolean
    className?: string
    mode?: 'export' | 'saved' // New prop to determine which view to show
    onSwitchToSaved?: () => void // Callback to switch to saved tab
    onEdit?: (config: ExportConfig) => void // Callback to edit (switch to export tab with data)
    initialConfig?: ExportConfig | null // Data to load when switching to edit
}

// Available data columns based on data type
const getAvailableColumns = (dataType: string, lang: 'th' | 'en') => {
    const t = translations[lang]
    const commonColumns = [
        { key: 'date', label: t.col_date },
        { key: 'index', label: t.col_index },
        { key: 'name', label: t.col_name },
        { key: 'id', label: t.col_id },
    ]

    if (dataType === 'accounts') {
        return [
            ...commonColumns,
            { key: 'status', label: t.col_status },
            { key: 'activeAdsCount', label: t.col_active_ads },
            { key: 'spendCap', label: t.col_spend_cap },
            { key: 'paymentMethod', label: t.col_payment_method },
            { key: 'timezone', label: t.col_timezone },
            { key: 'country', label: t.col_country },
            { key: 'currency', label: t.col_currency },
        ]
    }

    return [
        ...commonColumns,
        { key: 'status', label: t.col_status },
        { key: 'delivery', label: t.col_delivery },
        { key: 'results', label: t.col_results },
        { key: 'costPerResult', label: t.col_cpr },
        { key: 'reach', label: t.col_reach },
        { key: 'impressions', label: t.col_impressions },
        { key: 'frequency', label: t.col_frequency },
        { key: 'spend', label: t.col_spend },
        { key: 'dailyBudget', label: t.col_budget },
        { key: 'schedule', label: t.col_schedule },
        { key: 'clicks', label: t.col_clicks },
        { key: 'cpc', label: t.col_cpc },
        { key: 'ctr', label: t.col_ctr },

        { key: 'videoPlays', label: t.col_video_plays },
        { key: 'videoP25Watched', label: t.col_video_p25 },
        { key: 'videoP50Watched', label: t.col_video_p50 },
        { key: 'videoP75Watched', label: t.col_video_p75 },
        { key: 'videoP95Watched', label: t.col_video_p95 },
        { key: 'videoP100Watched', label: t.col_video_p100 },
        { key: 'videoAvgTimeWatched', label: 'VDO Average Play time' }, // Keep fallback or add to translations
        { key: 'video3SecWatched', label: '3-Second Video Plays' }, // Keep fallback

        { key: 'postEngagements', label: t.col_engagement },
        { key: 'newMessagingContacts', label: t.col_messaging },
        { key: 'costPerNewMessagingContact', label: t.col_cost_messaging },

        { key: 'accountName', label: t.col_account_name },
        { key: 'campaignName', label: t.col_campaign_name },
        { key: 'adsetName', label: t.col_adset_name },

        ...(dataType === 'ads' ? [
            { key: 'pageName', label: t.col_page_name },
            { key: 'previewLink', label: t.col_preview_link },
            { key: 'imageUrl', label: t.col_image },
            { key: 'objective', label: t.col_objective },
            { key: 'targeting', label: t.col_targeting },
            { key: 'created_time', label: t.col_created },
            { key: 'start_time', label: t.col_start_date },
            { key: 'stop_time', label: t.col_end_date },
        ] : [])
    ]
}

// Sheet column letters (A-Z, AA-AZ)
const sheetColumns = [
    ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
    ...Array.from({ length: 26 }, (_, i) => 'A' + String.fromCharCode(65 + i))
]

// Helper function to convert column letter to index (A=0, B=1, ..., AA=26)
function getColumnIndex(colLetter: string): number {
    let column = 0;
    const upper = colLetter.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        column += (upper.charCodeAt(i) - 64) * Math.pow(26, upper.length - i - 1);
    }
    return column - 1;
}

export default function GoogleSheetsConfigContent({
    dataType,
    data = [],
    onClose,
    standalone = false,
    className,
    mode = 'export',
    onSwitchToSaved,
    onEdit,
    initialConfig
}: GoogleSheetsConfigContentProps) {
    const { data: session } = useSession()
    const { language } = useLanguage()
    const lang = language as 'th' | 'en' // Cast to our translation keys
    const t = translations[lang]

    const [step, setStep] = useState(1) // 1: Basic, 2: Column Mapping, 3: Schedule
    const [isLoading, setIsLoading] = useState(false)
    const [savedConfigs, setSavedConfigs] = useState<ExportConfig[]>([])
    const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)

    const [googleStatus, setGoogleStatus] = useState<{ isConnected: boolean, email?: string, picture?: string } | null>(null)
    const { selectedAccounts, adAccounts, loading: accountsLoading } = useConfig()
    // Use selectedAccounts from settings/connections - same source as Ad Accounts tab
    const availableAccounts = (selectedAccounts?.length > 0 ? selectedAccounts : adAccounts || [])
        .filter((acc: any) => acc?.id || acc?.account_id)
        .map((acc: any) => ({
            id: acc.id || acc.account_id,
            name: acc.name || '',
            currency: acc.currency || 'USD',
            timezone: acc.timezone_name ?? acc.timezone_offset_hours_utc ?? '',
            status: acc.account_status ?? 1,
            accountName: acc.name || '',
        }))

    const [config, setConfig] = useState<ExportConfig>({
        name: '',
        spreadsheetUrl: '',
        spreadsheetName: '',
        sheetName: 'Sheet1',
        dataType: dataType,
        columnMapping: {},
        autoExportEnabled: false,
        exportFrequency: 'daily',
        exportHour: 9,
        exportMinute: 0,
        exportInterval: 6,
        appendMode: true,
        includeDate: true,
        accountIds: [],
        useAdAccountTimezone: false,
        adAccountTimezone: null
    })

    const [singleDate, setSingleDate] = useState<Date | undefined>(new Date())
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [isSavedCalendarOpen, setIsSavedCalendarOpen] = useState<Record<string, boolean>>({})
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [managedColumns, setManagedColumns] = useState<string[]>([])

    const availableColumns = getAvailableColumns(dataType, lang)

    // Initialize default column mapping
    useEffect(() => {
        // Reset mapping if data type changes OR if mapping is empty
        // We must check if dataType prop has changed relative to state to force update
        const typeChanged = config.dataType !== dataType
        const isEmpty = Object.keys(config.columnMapping).length === 0

        // Only apply defaults if we are NOT in edit mode (initialConfig handles that)
        // or if we are switching types (which implies we abandoned edit mode for that type)
        if ((isEmpty || typeChanged) && !initialConfig) {
            const defaultMapping: Record<string, string> = {}
            if (config.includeDate) {
                defaultMapping['date'] = 'A'
            }

            if (dataType === 'ads') {
                // A=Date, B=AD ID, C=Skip, D=Account Name, E=Skip, F=Reach, G=Impression, H=Engagement, I=Clicks, J=Message, K=Cost, L=Skip, M-T=Video stats
                defaultMapping['date'] = 'A'
                defaultMapping['id'] = 'B'
                defaultMapping['accountName'] = 'D'
                defaultMapping['reach'] = 'F'
                defaultMapping['impressions'] = 'G'
                defaultMapping['postEngagements'] = 'H'
                defaultMapping['clicks'] = 'I'
                defaultMapping['newMessagingContacts'] = 'J'
                defaultMapping['spend'] = 'K'
                defaultMapping['videoAvgTimeWatched'] = 'M'
                defaultMapping['videoPlays'] = 'N'
                defaultMapping['video3SecWatched'] = 'O'
                defaultMapping['videoP25Watched'] = 'P'
                defaultMapping['videoP50Watched'] = 'Q'
                defaultMapping['videoP75Watched'] = 'R'
                defaultMapping['videoP95Watched'] = 'S'
                defaultMapping['videoP100Watched'] = 'T'
            } else if (dataType === 'campaigns' || dataType === 'adsets') {
                defaultMapping['id'] = config.includeDate ? 'B' : 'A'
                defaultMapping['name'] = config.includeDate ? 'C' : 'B'
                defaultMapping['reach'] = config.includeDate ? 'F' : 'E'
                defaultMapping['impressions'] = config.includeDate ? 'G' : 'F'
                defaultMapping['postEngagements'] = config.includeDate ? 'H' : 'G'
                defaultMapping['clicks'] = config.includeDate ? 'I' : 'H'
                defaultMapping['newMessagingContacts'] = config.includeDate ? 'J' : 'I'
                defaultMapping['spend'] = config.includeDate ? 'K' : 'J'
        } else {
            let startIndex = 0
            if (config.includeDate) {
                defaultMapping['date'] = 'A'
                startIndex = 1
            }
            availableColumns.filter(col => col.key !== 'date').forEach((col, index) => {
                defaultMapping[col.key] = sheetColumns[startIndex + index] || 'skip'
            })
        }

            setConfig(prev => ({
                ...prev,
                dataType: dataType, // Sync state with prop
                columnMapping: defaultMapping
            }))

            // Initialize managed columns from mapping (continuous sequence)
            const usedCols = Object.values(defaultMapping).filter(c => c !== 'skip')
            let maxIndex = -1
            usedCols.forEach(col => {
                const idx = sheetColumns.indexOf(col)
                if (idx > maxIndex) maxIndex = idx
            })
            // Ensure at least some columns if empty (e.g. A-E)
            if (maxIndex < 4) maxIndex = 4

            setManagedColumns(sheetColumns.slice(0, maxIndex + 1))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataType, config.includeDate, initialConfig])

    const fetchGoogleStatus = async () => {
        try {
            const res = await fetch('/api/auth/google/status')
            if (res.ok) {
                const status = await res.json()
                setGoogleStatus(status)
            }
        } catch (error) {
            console.error('Error fetching google status:', error)
        }
    }

    const fetchSavedConfigs = useCallback(async () => {
        try {
            const res = await fetch('/api/export/google-sheets')
            if (res.ok) {
                const { configs } = await res.json()
                setSavedConfigs(configs.filter((c: ExportConfig) => c.dataType === dataType))
            }
        } catch (error) {
            console.error('Error fetching configs:', error)
        }
    }, [dataType])

    // Fetch Google Status and Saved Configs (accounts come from AdAccountContext = settings/connections)
    useEffect(() => {
        fetchGoogleStatus()
        fetchSavedConfigs()
    }, [fetchSavedConfigs])

    const handleSaveConfig = async () => {
        // Auto-generate name if not provided
        if (!config.name || config.name.trim() === '') {
            const autoName = config.spreadsheetName
                ? `${config.spreadsheetName} - ${config.sheetName}`
                : `Export ${new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}`
            config.name = autoName
            setConfig({ ...config, name: autoName })
        }

        if (!config.spreadsheetUrl || !config.sheetName) {
            toast.error('กรุณากรอก URL และชื่อ Sheet')
            return
        }

        setIsLoading(true)
        try {
            const method = selectedConfigId ? 'PUT' : 'POST'
            const body = selectedConfigId
                ? { id: selectedConfigId, ...config }
                : config

            const res = await fetch('/api/export/google-sheets', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                const { config: savedConfig } = await res.json()
                toast.success('บันทึกการตั้งค่าสำเร็จ')
                setSelectedConfigId(savedConfig.id!)
                fetchSavedConfigs()

                // Switch to saved tab
                if (onSwitchToSaved) {
                    setTimeout(() => {
                        onSwitchToSaved()
                    }, 500)
                }

                if (standalone) {
                    resetConfig()
                } else {
                    if (onClose) onClose()
                }
            } else {
                throw new Error('Failed to save')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteConfig = async (id: string) => {
        if (!confirm('ต้องการลบการตั้งค่านี้?')) return

        try {
            const res = await fetch(`/api/export/google-sheets?id=${id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                toast.success('ลบสำเร็จ')
                if (selectedConfigId === id) {
                    setSelectedConfigId(null)
                    resetConfig()
                }
                fetchSavedConfigs()
            }
        } catch {
            toast.error(t.generic_error)
        }
    }

    const handleLoadConfig = (savedConfig: ExportConfig, targetStep: number = 3) => {
        setSelectedConfigId(savedConfig.id || null)
        let mapping = typeof savedConfig.columnMapping === 'string'
            ? JSON.parse(savedConfig.columnMapping)
            : savedConfig.columnMapping || {}
        // Backwards compat: add date=A when includeDate but no date in mapping
        if (savedConfig.includeDate && !mapping.date) {
            mapping = { date: 'A', ...mapping }
        }

        setConfig({
            ...savedConfig,
            columnMapping: mapping,
            accountIds: typeof savedConfig.accountIds === 'string'
                ? JSON.parse(savedConfig.accountIds)
                : savedConfig.accountIds || []
        })

        // Initialize managed columns from mapping (continuous)
        const usedCols = Object.values(mapping).filter((c: any) => c !== 'skip')
        let maxIndex = -1
        usedCols.forEach((col: any) => {
            const idx = sheetColumns.indexOf(col)
            if (idx > maxIndex) maxIndex = idx
        })
        if (maxIndex < 4) maxIndex = 4
        setManagedColumns(sheetColumns.slice(0, maxIndex + 1))

        setStep(targetStep)
    }

    // Effect to handle initialConfig (Edit Mode)
    useEffect(() => {
        if (initialConfig) {
            handleLoadConfig(initialConfig, 1) // Load and go to Step 1 (Edit)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialConfig])

    const resetConfig = () => {
        // Default mapping based on user preference
        const defaultMapping: Record<string, string> = {}
        if (config.includeDate) {
            defaultMapping['date'] = 'A'
        }

        if (dataType === 'ads') {
            // A=Date, B=AD ID, C=Skip, D=Account Name, E=Skip, F=Reach, G=Impression, H=Engagement, I=Clicks, J=Message, K=Cost, L=Skip, M-T=Video stats
            defaultMapping['date'] = 'A'
            defaultMapping['id'] = 'B'
            defaultMapping['accountName'] = 'D'
            defaultMapping['reach'] = 'F'
            defaultMapping['impressions'] = 'G'
            defaultMapping['postEngagements'] = 'H'
            defaultMapping['clicks'] = 'I'
            defaultMapping['newMessagingContacts'] = 'J'
            defaultMapping['spend'] = 'K'
            defaultMapping['videoAvgTimeWatched'] = 'M'
            defaultMapping['videoPlays'] = 'N'
            defaultMapping['video3SecWatched'] = 'O'
            defaultMapping['videoP25Watched'] = 'P'
            defaultMapping['videoP50Watched'] = 'Q'
            defaultMapping['videoP75Watched'] = 'R'
            defaultMapping['videoP95Watched'] = 'S'
            defaultMapping['videoP100Watched'] = 'T'
        } else if (dataType === 'campaigns' || dataType === 'adsets') {
            defaultMapping['id'] = config.includeDate ? 'B' : 'A'
            defaultMapping['name'] = config.includeDate ? 'C' : 'B'
            defaultMapping['reach'] = config.includeDate ? 'F' : 'E'
            defaultMapping['impressions'] = config.includeDate ? 'G' : 'F'
            defaultMapping['postEngagements'] = config.includeDate ? 'H' : 'G'
            defaultMapping['clicks'] = config.includeDate ? 'I' : 'H'
            defaultMapping['newMessagingContacts'] = config.includeDate ? 'J' : 'I'
            defaultMapping['spend'] = config.includeDate ? 'K' : 'J'
        } else {
            availableColumns.forEach((col, index) => {
                const startIndex = config.includeDate ? index + 1 : index
                defaultMapping[col.key] = sheetColumns[startIndex] || 'skip'
            })
        }

        setConfig({
            name: '',
            spreadsheetUrl: '',
            spreadsheetName: '',
            sheetName: 'Sheet1',
            dataType: dataType,
            columnMapping: defaultMapping,
            autoExportEnabled: false,
            exportFrequency: 'daily',
            exportHour: 9,
            exportMinute: 0,
            exportInterval: 6,
            appendMode: true,
            includeDate: true,
            accountIds: [],
            useAdAccountTimezone: false,
            adAccountTimezone: null
        })

        // Initialize managed columns (continuous)
        const usedCols = Object.values(defaultMapping).filter(c => c !== 'skip')
        let maxIndex = -1
        usedCols.forEach(col => {
            const idx = sheetColumns.indexOf(col)
            if (idx > maxIndex) maxIndex = idx
        })
        if (maxIndex < 4) maxIndex = 4
        setManagedColumns(sheetColumns.slice(0, maxIndex + 1))

        setSelectedConfigId(null)
        setStep(1)
    }

    const prepareExportData = (): string[][] => {
        const rows: string[][] = []
        const useDate = singleDate || new Date()
        const dd = String(useDate.getDate()).padStart(2, '0')
        const mm = String(useDate.getMonth() + 1).padStart(2, '0')
        const yyyy = useDate.getFullYear()
        const dateStr = `${dd}/${mm}/${yyyy}`

        let maxColIndex = 0
        Object.values(config.columnMapping).forEach(col => {
            if (col !== 'skip') {
                const index = getColumnIndex(col)
                if (index > maxColIndex) maxColIndex = index
            }
        })
        if (maxColIndex < 19 && config.dataType === 'ads') maxColIndex = 19

        const headerRow: string[] = new Array(maxColIndex + 1).fill('')
        Object.entries(config.columnMapping).forEach(([key, col]) => {
            if (col !== 'skip') {
                const colIndex = getColumnIndex(col)
                if (colIndex >= 0) {
                    const column = availableColumns.find(c => c.key === key)
                    headerRow[colIndex] = column?.label || key
                }
            }
        })
        rows.push(headerRow)

        data.forEach((item, index) => {
            const row: string[] = new Array(maxColIndex + 1).fill('')

            Object.entries(config.columnMapping).forEach(([key, col]) => {
                if (col !== 'skip') {
                    const colIndex = getColumnIndex(col)
                    if (colIndex >= 0) {
                        let value = ''
                        if (key === 'date') {
                            value = dateStr
                        } else switch (key) {
                            case 'index':
                                value = String(index + 1)
                                break
                            case 'spendCap':
                            case 'budget':
                                value = item[key] ? (parseFloat(item[key]) / 100).toFixed(2) : ''
                                break
                            case 'spend':
                                value = item.spend ? parseFloat(item.spend).toFixed(2) : ''
                                break
                            case 'videoAvgTimeWatched':
                                const vVal = item.videoAvgTimeWatched ? parseFloat(item.videoAvgTimeWatched) : 0
                                if (vVal === 0) {
                                    value = '00.00'
                                } else {
                                    const m = Math.floor(vVal / 60)
                                    const s = Math.floor(vVal % 60)
                                    value = `${String(m).padStart(2, '0')}.${String(s).padStart(2, '0')}`
                                }
                                break
                            default:
                                value = String(item[key] || '')
                        }
                        row[colIndex] = value
                    }
                }
            })

            rows.push(row)
        })

        return rows
    }

    const handleExportNow = async () => {
        if (!config.spreadsheetUrl) {
            toast.error(t.enter_url_error)
            return
        }

        setIsLoading(true)
        try {
            let currentConfigId = selectedConfigId

            // Save config first (creates new or updates existing) so trigger has latest
            const method = currentConfigId ? 'PUT' : 'POST'
            const saveRes = await fetch('/api/export/google-sheets', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, id: currentConfigId })
            })

            if (saveRes.ok) {
                const { config: savedConfig } = await saveRes.json()
                currentConfigId = savedConfig.id
                if (!selectedConfigId) {
                    setSelectedConfigId(savedConfig.id!)
                    fetchSavedConfigs()
                }
            } else {
                const errData = await saveRes.json().catch(() => ({}))
                throw new Error(errData.error || 'Failed to save config')
            }

            if (googleStatus?.isConnected) {
                const res = await fetch('/api/export/google-sheets/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        configId: currentConfigId,
                        dateRange: singleDate ? {
                            from: format(singleDate, 'yyyy-MM-dd'),
                            to: format(singleDate, 'yyyy-MM-dd')
                        } : undefined
                    })
                })

                const result = await res.json()
                if (res.ok) {
                    toast.success(lang === 'th'
                        ? `ส่งออกสำเร็จ! เพิ่มข้อมูล ${result.count} แถว`
                        : `Export successful! Added ${result.count} rows`)
                    window.open(config.spreadsheetUrl, '_blank')

                    // Switch to saved tab
                    if (onSwitchToSaved) {
                        setTimeout(() => {
                            onSwitchToSaved()
                        }, 500)
                    }

                    // Always redirect to config list (Step 1) after export
                    resetConfig()
                    if (onClose && !standalone) onClose()
                } else {
                    throw new Error(result.error || 'Export failed')
                }
            } else {
                if (data.length === 0) {
                    // For standalone page without data, we can't do clipboard export
                    toast.error(t.no_data_error)
                    return
                }
                const exportData = prepareExportData()
                const tsvContent = exportData.map(row => row.join('\t')).join('\n')
                await navigator.clipboard.writeText(tsvContent)

                toast.success(
                    <div className="flex flex-col gap-1">
                        <span className="font-medium">
                            {lang === 'th' ? `คัดลอก ${data.length} รายการแล้ว!` : `Copied ${data.length} items!`}
                        </span>
                        <span className="text-sm">
                            {lang === 'th' ? 'ไปที่ Google Sheets แล้วกด Ctrl+V เพื่อวาง' : 'Go to Google Sheets and press Ctrl+V to paste'}
                        </span>
                    </div>
                )
                window.open(config.spreadsheetUrl, '_blank')

                // Switch to saved tab
                if (onSwitchToSaved) {
                    setTimeout(() => {
                        onSwitchToSaved()
                    }, 500)
                }

                // Always redirect to config list (Step 1) after export
                resetConfig()
                if (onClose && !standalone) onClose()
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t.generic_error
            toast.error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const updateColumnMapping = (dataKey: string, sheetColumn: string) => {
        setConfig(prev => ({
            ...prev,
            columnMapping: {
                ...prev.columnMapping,
                [dataKey]: sheetColumn
            }
        }))
    }

    const [availableSheets, setAvailableSheets] = useState<{ title: string, sheetId: number }[]>([])
    const [isFetchingSheets, setIsFetchingSheets] = useState(false)

    const handleConnectSheet = async () => {
        if (!config.spreadsheetUrl) {
            toast.error(t.enter_url_error)
            return
        }

        setIsFetchingSheets(true)
        try {
            const res = await fetch('/api/google-sheets/list-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spreadsheetUrl: config.spreadsheetUrl })
            })

            const data = await res.json()

            if (res.ok) {
                console.log('Spreadsheet data:', data)
                setAvailableSheets(data.sheets)
                setConfig(prev => ({
                    ...prev,
                    spreadsheetId: data.spreadsheetId,
                    spreadsheetName: data.spreadsheetName || 'Google Sheets',
                    sheetName: data.sheets[0]?.title || 'Sheet1'
                }))
                toast.success('เชื่อมต่อสำเร็จ! กรุณาเลือก Sheet')
            } else {
                throw new Error(data.error)
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            toast.error(error.message || 'ไม่สามารถเชื่อมต่อได้')
        } finally {
            setIsFetchingSheets(false)
        }
    }

    return (
        <div className={cn("space-y-6", standalone ? "p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-sm" : "", className)}>

            {standalone && (
                <div className="flex items-center gap-2 mb-6 pb-4 border-b">
                    <FileSpreadsheet className="h-6 w-6 text-green-600" />
                    <h1 className="text-2xl font-bold">Google Sheets Export</h1>
                </div>
            )}

            {/* Mode: Saved Configurations List */}
            {mode === 'saved' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Settings2 className="h-5 w-5" />
                                {t.saved_configs_title}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {lang === 'th' ? 'จัดการและแก้ไขการตั้งค่าการส่งออกของคุณ' : 'Manage and edit your export configurations'}
                            </p>
                        </div>
                        {selectedConfigId && (
                            <Button
                                variant="outline"
                                onClick={resetConfig}
                                size="sm"
                            >
                                {t.create_new_btn}
                            </Button>
                        )}
                    </div>

                    {savedConfigs.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50">
                            <Settings2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-600 mb-2">
                                {t.no_saved_configs}
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                {lang === 'th' ? 'เริ่มต้นโดยการสร้างการตั้งค่าการส่งออกใหม่ในแท็บ "เลือกบัญชีโฆษณา"' : 'Start by creating a new export configuration in the "Select Account" tab'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {savedConfigs.map(saved => {
                                const accountIds = typeof saved.accountIds === 'string'
                                    ? JSON.parse(saved.accountIds)
                                    : (saved.accountIds || [])
                                const isExpanded = selectedConfigId === saved.id

                                return (
                                    <div
                                        key={saved.id}
                                        className={cn(
                                            "bg-white rounded-xl border-2 shadow-sm hover:shadow-md transition-all",
                                            isExpanded ? "border-blue-500 bg-blue-50" : "border-gray-200"
                                        )}
                                    >
                                        <div className="flex items-center justify-between p-4">
                                            <div className="flex-1">
                                                <div className="font-semibold text-base mb-1">
                                                    {saved.name || saved.spreadsheetName || 'Untitled Config'}
                                                </div>
                                                <div className="text-xs text-gray-500 mb-2">
                                                    📊 {saved.spreadsheetName && <span className="font-medium">{saved.spreadsheetName}</span>}
                                                    {saved.spreadsheetName && <span className="mx-1">•</span>}
                                                    <span>Sheet: {saved.sheetName}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-medium">
                                                        👥 {accountIds.length} {t.account}
                                                    </span>
                                                    {saved.autoExportEnabled ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-medium">
                                                            ⏰ Auto: {String(saved.exportHour).padStart(2, '0')}:{String(saved.exportMinute || 0).padStart(2, '0')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                                                            ✋ Manual Only
                                                        </span>
                                                    )}
                                                </div>
                                                {saved.lastExportAt && (
                                                    <div className="text-xs text-gray-400 mt-2">
                                                        {t.last_export}: {new Date(saved.lastExportAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 ml-4">
                                                <Button
                                                    size="sm"
                                                    variant={isExpanded ? "default" : "outline"}
                                                    onClick={() => {
                                                        if (isExpanded) {
                                                            setSelectedConfigId(null)
                                                        } else {
                                                            handleLoadConfig(saved)
                                                        }
                                                    }}
                                                >
                                                    {isExpanded ? (lang === 'th' ? '✓ เลือกอยู่' : '✓ Selected') : (lang === 'th' ? 'เลือกใช้' : 'Select')}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        if (onEdit) onEdit(saved)
                                                    }}
                                                >
                                                    {t.edit}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeleteConfig(saved.id!)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Expanded Export Section */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2">
                                                <div className="border-t pt-4">
                                                    <Label>{lang === 'th' ? 'เลือกวันที่ของข้อมูล' : 'Select Date Range'}</Label>
                                                    <div className="grid gap-2 mt-2">
                                                        <Button
                                                            id="date"
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full justify-start text-left font-normal",
                                                                !singleDate && "text-muted-foreground"
                                                            )}
                                                            onClick={() => setIsSavedCalendarOpen(prev => ({ ...prev, [saved.id!]: !prev[saved.id!] }))}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {singleDate ? (
                                                                format(singleDate, "dd/MM/yyyy")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                        </Button>
                                                        {isSavedCalendarOpen[saved.id!] && (
                                                            <div className="border rounded-md p-3 mt-2 bg-white w-fit mx-auto sm:mx-0">
                                                                <Calendar
                                                                    mode="single"
                                                                    defaultMonth={singleDate}
                                                                    selected={singleDate}
                                                                    onSelect={(date) => {
                                                                        if (date) {
                                                                            setSingleDate(date);
                                                                            setIsSavedCalendarOpen(prev => ({ ...prev, [saved.id!]: false }));
                                                                        }
                                                                    }}
                                                                    numberOfMonths={1}
                                                                />
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-gray-500">
                                                            * {lang === 'th' ? 'ข้อมูล Insights (Spend, Clicks, etc.) จะถูกดึงเฉพาะวันที่เลือกเท่านั้น' : 'Insights data (Spend, Clicks, etc.) is fetched for the selected date only.'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={handleExportNow}
                                                    disabled={isLoading}
                                                    className="w-full"
                                                    size="lg"
                                                >
                                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                    {t.export_btn}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Mode: Export (Original Flow) */}
            {mode === 'export' && (
                <>
                    <div className="flex items-center justify-center gap-2 py-4">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${step >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                        <div className={`h-1 w-8 rounded-full ${step >= 2 ? 'bg-green-600' : 'bg-gray-200'}`} />
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${step >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                        <div className={`h-1 w-8 rounded-full ${step >= 3 ? 'bg-green-600' : 'bg-gray-200'}`} />
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${step >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
                    </div>
                    <div className="text-center text-sm text-gray-500 mb-4">
                        {step === 1 && t.step1_title}
                        {step === 2 && t.step2_title}
                        {step === 3 && t.step3_title}
                    </div>

                    {/* Step 1: Select Ad Accounts (same source as settings/connections ad-accounts) */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t.step1_title}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {lang === 'th' ? 'บัญชีโฆษณาจากการเลือกที่' : 'Accounts from selection at'}{' '}
                                    <a href="/settings/connections?tab=ad-accounts" className="text-primary hover:underline">
                                        Settings → Connections → Ad Accounts
                                    </a>
                                </p>
                                {accountsLoading ? (
                                    <div className="h-[300px] flex items-center justify-center border rounded-xl bg-muted/30">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : availableAccounts.length === 0 ? (
                                    <div className="h-[300px] flex flex-col items-center justify-center border rounded-xl bg-muted/30 p-6 text-center">
                                        <p className="text-sm font-medium mb-2">
                                            {lang === 'th' ? 'ยังไม่มีบัญชีโฆษณา' : 'No ad accounts yet'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-4">
                                            {lang === 'th' ? 'ไปที่ Settings → Connections → Ad Accounts เพื่อเลือกบัญชีโฆษณา' : 'Go to Settings → Connections → Ad Accounts to select ad accounts'}
                                        </p>
                                        <Button asChild variant="outline" size="sm">
                                            <a href="/settings/connections?tab=ad-accounts">
                                                {lang === 'th' ? 'ไปที่ Connections' : 'Go to Connections'}
                                            </a>
                                        </Button>
                                    </div>
                                ) : (
                                <>
                                <Input
                                    placeholder={t.search_placeholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="mb-2"
                                />
                                <div className="h-[300px] overflow-y-auto border rounded-xl p-2 bg-white space-y-1">
                                    {availableAccounts
                                        .filter(acc =>
                                            acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            acc.id.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map(acc => {
                                            const isChecked = config.accountIds.includes(acc.id)
                                            return (
                                                <div
                                                    key={acc.id}
                                                    className="flex items-center space-x-3 py-1.5 px-3 hover:bg-blue-50 transition-colors rounded-lg border border-transparent hover:border-blue-100"
                                                >
                                                    <Checkbox
                                                        id={`acc-${acc.id}`}
                                                        className="h-4 w-4 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setConfig(prev => ({ ...prev, accountIds: [...prev.accountIds, acc.id] }))
                                                            } else {
                                                                setConfig(prev => ({ ...prev, accountIds: prev.accountIds.filter(id => id !== acc.id) }))
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor={`acc-${acc.id}`} className="flex-1 cursor-pointer select-none">
                                                        <div className="text-sm font-medium text-gray-700">
                                                            {acc.name} <span className="text-gray-400 font-normal text-xs">({acc.id})</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 flex gap-2">
                                                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 text-[10px]">{acc.timezone}</span>
                                                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 text-[10px]">{acc.currency}</span>
                                                        </div>
                                                    </label>
                                                </div>
                                            )
                                        })}
                                </div>
                                <p className="text-xs text-gray-500">
                                    * {lang === 'th' ? 'สามารถเลือกได้หลายบัญชี' : 'Multiple accounts can be selected'} {searchQuery && `(${availableAccounts.filter(acc => acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || acc.id.toLowerCase().includes(searchQuery.toLowerCase())).length} matches)`}
                                </p>
                                </>
                                )}
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={() => setStep(2)}
                                    disabled={config.accountIds.length === 0 || availableAccounts.length === 0}
                                    className="w-full sm:w-auto"
                                >
                                    {t.next_btn}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Connect Google Sheet */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label>{t.sheet_url}</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={t.sheet_url_placeholder}
                                        value={config.spreadsheetUrl}
                                        onChange={e => setConfig({ ...config, spreadsheetUrl: e.target.value })}
                                    />
                                    <Button onClick={handleConnectSheet} disabled={isFetchingSheets}>
                                        {isFetchingSheets ? <Loader2 className="h-4 w-4 animate-spin" /> : t.connect_btn}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {lang === 'th' ? 'วางลิงก์ Google Sheet ที่คุณต้องการส่งออกข้อมูลไป' : 'Paste the Google Sheet URL where you want to export data'}
                                </p>
                            </div>

                            {availableSheets.length > 0 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <Label>{t.sheet_tab_name}</Label>
                                        <Select
                                            value={config.sheetName}
                                            onValueChange={val => setConfig({ ...config, sheetName: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t.sheet_tab_placeholder} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSheets.map(sheet => (
                                                    <SelectItem key={sheet.sheetId} value={sheet.title}>
                                                        {sheet.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label>{t.mapping_title}</Label>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={managedColumns.length <= 1}
                                                    onClick={() => {
                                                        const newCols = [...managedColumns]
                                                        const removedCol = newCols.pop()
                                                        setManagedColumns(newCols)

                                                        // Clean up mapping
                                                        if (removedCol) {
                                                            const newMapping = { ...config.columnMapping }
                                                            Object.keys(newMapping).forEach(key => {
                                                                if (newMapping[key] === removedCol) delete newMapping[key]
                                                            })
                                                            setConfig(prev => ({ ...prev, columnMapping: newMapping }))
                                                        }
                                                    }}
                                                >
                                                    {t.remove_last_btn}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        // Append next available column in sequence (ignoring gaps)
                                                        let nextIndex = 0
                                                        if (managedColumns.length > 0) {
                                                            // Find the highest column currently managed
                                                            const maxCol = managedColumns.reduce((max, col) => {
                                                                const idx = sheetColumns.indexOf(col)
                                                                return idx > max ? idx : max
                                                            }, -1)
                                                            nextIndex = maxCol + 1
                                                        }

                                                        if (nextIndex < sheetColumns.length) {
                                                            setManagedColumns(prev => [...prev, sheetColumns[nextIndex]])
                                                        }
                                                    }}
                                                >
                                                    {t.add_column_btn}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2 max-h-[400px] overflow-y-auto p-2 border rounded-xl bg-gray-50">
                                            {managedColumns.map((colLetter) => {
                                                // Find which field is mapped to this column
                                                const mappedField = Object.entries(config.columnMapping).find(([_, letter]) => letter === colLetter)?.[0] || 'empty'

                                                return (
                                                    <div key={colLetter} className="flex items-center gap-2 bg-white p-2 rounded border">
                                                        <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded font-bold text-sm text-gray-600">
                                                            {colLetter}
                                                        </div>
                                                        <div className="flex-1">
                                                            <Select
                                                                value={mappedField}
                                                                onValueChange={(newField) => {
                                                                    const newMapping = { ...config.columnMapping }

                                                                    // 1. Remove any field that was previously mapped to THIS column
                                                                    Object.keys(newMapping).forEach(key => {
                                                                        if (newMapping[key] === colLetter) delete newMapping[key]
                                                                    })

                                                                    // 2. Set the new field to this column (if not skip/empty)
                                                                    if (newField && newField !== 'empty') {
                                                                        // If this field was mapped to another column, unmap it there?
                                                                        // Backend supports one field to one column logic mainly?
                                                                        // If user maps 'Name' to Col A, then 'Name' to Col B. 
                                                                        // The key is 'Name'. { name: 'B' }. It effectively moves it.
                                                                        // So we don't need to manually clear 'Name' from old column, 
                                                                        // because 'Name' is the key in the object! It just updates the value.

                                                                        newMapping[newField] = colLetter
                                                                    }

                                                                    setConfig(prev => ({ ...prev, columnMapping: newMapping }))
                                                                }}
                                                            >
                                                                <SelectTrigger className={`h-9 ${mappedField === 'empty' ? 'text-gray-400' : ''}`}>
                                                                    <SelectValue placeholder={t.select_data_placeholder} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="empty" className="text-gray-500 font-medium">
                                                                        {t.default_skip}
                                                                    </SelectItem>
                                                                    {availableColumns.map(col => (
                                                                        <SelectItem key={col.key} value={col.key}>
                                                                            {col.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-gray-400 hover:text-red-500"
                                                            onClick={() => {
                                                                // Remove column from UI
                                                                setManagedColumns(prev => prev.filter(c => c !== colLetter))

                                                                // Clear mapping
                                                                const newMapping = { ...config.columnMapping }
                                                                Object.keys(newMapping).forEach(key => {
                                                                    if (newMapping[key] === colLetter) delete newMapping[key]
                                                                })
                                                                setConfig(prev => ({ ...prev, columnMapping: newMapping }))
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )
                                            })}
                                            {managedColumns.length === 0 && (
                                                <div className="text-center py-8 text-gray-400 text-sm">
                                                    {t.click_to_add_column}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={config.includeDate}
                                        onCheckedChange={checked => {
                                            const newMapping = { ...config.columnMapping }
                                            if (checked) {
                                                newMapping['date'] = 'A'
                                                if (!managedColumns.includes('A')) {
                                                    setManagedColumns(prev => ['A', ...prev])
                                                }
                                            } else {
                                                delete newMapping['date']
                                            }
                                            setConfig(prev => ({ ...prev, includeDate: checked, columnMapping: newMapping }))
                                        }}
                                    />
                                    <Label>{t.auto_date_column}</Label>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={config.appendMode}
                                            onCheckedChange={checked => setConfig({ ...config, appendMode: checked })}
                                        />
                                        <Label>{t.append_mode_label}</Label>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-11">
                                        {config.appendMode
                                            ? t.append_desc_true
                                            : t.append_desc_false}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button variant="outline" onClick={() => setStep(1)}>ย้อนกลับ</Button>
                                <Button
                                    onClick={() => setStep(3)}
                                    disabled={!config.sheetName}
                                >
                                    ถัดไป
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Schedule & Manual Export */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-10 w-10 bg-white rounded-full shadow-sm overflow-hidden flex items-center justify-center border">
                                        {(session?.user?.image || googleStatus?.picture) ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={session?.user?.image || googleStatus?.picture}
                                                alt="Profile"
                                                className="h-full w-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <Image src="/google-sheets-icon.png" alt="Google Sheets" width={24} height={24} />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-blue-900">{t.step3_header}</h4>
                                        <p className="text-xs text-blue-700">
                                            {googleStatus?.isConnected
                                                ? `${t.connected_as}: ${googleStatus.email}`
                                                : t.please_login}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {googleStatus?.isConnected ? (
                                <div className="space-y-4">
                                    <div className="space-y-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                                        <Label htmlFor="config-name" className="flex items-center gap-2 text-blue-900 font-medium">
                                            <span className="text-lg">📝</span>
                                            {t.config_name}
                                        </Label>
                                        <Input
                                            id="config-name"
                                            placeholder={t.config_name_placeholder}
                                            value={config.name}
                                            onChange={e => setConfig({ ...config, name: e.target.value })}
                                            className="w-full bg-white border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                                        />
                                        <p className="text-xs text-blue-700">
                                            {t.auto_generate_name_hint}
                                        </p>
                                    </div>

                                    <Tabs defaultValue="manual" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="manual">{t.tab_manual}</TabsTrigger>
                                            <TabsTrigger value="auto">{t.tab_auto}</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="manual" className="space-y-4 pt-4">
                                            <div className="space-y-2">
                                                <Label>{t.select_date}</Label>
                                                <div className="grid gap-2">
                                                    <Button
                                                        id="date"
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal",
                                                            !singleDate && "text-muted-foreground"
                                                        )}
                                                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {singleDate ? (
                                                            format(singleDate, "dd/MM/yyyy")
                                                        ) : (
                                                            <span>{t.select_date}</span>
                                                        )}
                                                    </Button>
                                                    {isCalendarOpen && (
                                                        <div className="border rounded-md p-3 mt-2 bg-white w-fit">
                                                            <Calendar
                                                                mode="single"
                                                                defaultMonth={singleDate}
                                                                selected={singleDate}
                                                                onSelect={(date) => {
                                                                    if (date) {
                                                                        setSingleDate(date);
                                                                        setIsCalendarOpen(false);
                                                                    }
                                                                }}
                                                                numberOfMonths={1}
                                                            />
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-gray-500">
                                                        * {t.insights_date_hint}
                                                    </p>
                                                </div>

                                                <div className="flex gap-2 mt-4">
                                                    <Button onClick={handleSaveConfig} disabled={isLoading} variant="outline" className="flex-1">
                                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                        {t.save_config_only}
                                                    </Button>
                                                    <Button onClick={handleExportNow} disabled={isLoading} className="flex-1">
                                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                        {t.export_btn}
                                                    </Button>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="auto" className="space-y-4 pt-4">
                                            <div className="space-y-4">
                                                <div className="flex items-center space-x-2">
                                                    <Switch
                                                        checked={config.autoExportEnabled}
                                                        onCheckedChange={checked => setConfig({ ...config, autoExportEnabled: checked })}
                                                    />
                                                    <Label>{t.enable_auto_export}</Label>
                                                </div>

                                                {config.autoExportEnabled && (
                                                    <div className="space-y-4 border p-4 rounded bg-gray-50 animate-in fade-in">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>{t.export_time}</Label>
                                                                <div className="flex gap-2 items-center">
                                                                    <Select
                                                                        value={String(config.exportHour)}
                                                                        onValueChange={val => setConfig({ ...config, exportHour: parseInt(val) })}
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {Array.from({ length: 24 }).map((_, i) => (
                                                                                <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <span className="text-gray-500 text-sm">{t.time_suffix}</span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>{t.lookback_period}</Label>
                                                                <Select
                                                                    value={String(config.exportInterval || 6)}
                                                                    onValueChange={val => setConfig({ ...config, exportInterval: parseInt(val) })}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="1">1 {t.hour_suffix}</SelectItem>
                                                                        <SelectItem value="6">6 {t.hour_suffix}</SelectItem>
                                                                        <SelectItem value="12">12 {t.hour_suffix}</SelectItem>
                                                                        <SelectItem value="24">24 {t.hour_suffix}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center space-x-2">
                                                            <Switch
                                                                checked={config.useAdAccountTimezone}
                                                                onCheckedChange={checked => setConfig({ ...config, useAdAccountTimezone: checked })}
                                                            />
                                                            <Label>{t.use_ad_account_timezone}</Label>
                                                        </div>
                                                    </div>
                                                )}

                                                <Button onClick={handleSaveConfig} disabled={isLoading} className="w-full">
                                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                    {t.save_btn}
                                                </Button>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md text-sm">
                                        {t.google_not_connected_warn}
                                    </div>

                                    {data.length > 0 ? (
                                        <Button onClick={handleExportNow} disabled={isLoading} className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 shadow-md">
                                            {t.copy_to_clickboard}
                                        </Button>
                                    ) : (
                                        <div className="text-center text-sm text-gray-400 p-2">
                                            {t.no_data_to_copy}
                                        </div>
                                    )}

                                    <Button onClick={handleSaveConfig} variant="outline" disabled={isLoading} className="w-full h-10">
                                        {t.save_config_only}
                                    </Button>
                                </div>
                            )}

                            <div className="flex justify-between pt-4">
                                <Button variant="outline" onClick={() => setStep(2)}>ย้อนกลับ</Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
