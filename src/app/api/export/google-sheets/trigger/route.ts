/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getRequestMetadata } from '@/lib/audit'
import { refreshAccessToken, getGoogleSheetsClient } from '@/lib/google-auth'
import { getAdAccounts, getCampaignsWithDeliveryStatus, getAdSetsWithDeliveryStatus, getAds, getInsights } from '@/lib/facebook'

// Helper function to convert column letter to index (A=0, B=1, ..., AA=26)
function getColumnIndex(colLetter: string): number {
    let column = 0;
    const upper = colLetter.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        column += (upper.charCodeAt(i) - 64) * Math.pow(26, upper.length - i - 1);
    }
    return column - 1;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { configId, cronSecret } = body as { configId?: string; cronSecret?: string }

        if (!configId) {
            return NextResponse.json({ error: 'Config ID required' }, { status: 400 })
        }

        const config = await (prisma as any).exportConfig.findUnique({
            where: { id: configId }
        })

        if (!config) {
            return NextResponse.json({ error: 'Config not found' }, { status: 404 })
        }

        const cronOk = !!(
            process.env.CRON_SECRET &&
            cronSecret &&
            process.env.CRON_SECRET.length >= 32 &&
            cronSecret === process.env.CRON_SECRET
        )
        let userId: string
        let session: Session | null = null

        if (cronOk) {
            userId = config.userId
        } else {
            session = await getServerSession(authOptions) as Session | null
            if (!session?.user?.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
            if (config.userId !== session.user.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
            }
            userId = session.user.id
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                metaAccount: { select: { accessToken: true } },
                accounts: {
                    where: {
                        provider: { in: ['google', 'facebook'] }
                    }
                },
                teamMembers: { select: { accessToken: true } }
            }
        })

        const googleAccount = user?.accounts.find((a: any) => a.provider === 'google')
        const facebookAccount = user?.accounts.find((a: any) => a.provider === 'facebook')

        if (!googleAccount) {
            return NextResponse.json({ error: 'Google Account not connected. Please sign in with Google.' }, { status: 400 })
        }

        if (!googleAccount.refresh_token) {
            return NextResponse.json({ error: 'Google Refresh Token missing. Please sign out and sign in again to grant permissions.' }, { status: 400 })
        }

        // Resolve Facebook token (same order as ad-accounts route)
        let fbToken: string | null = null

        // 1. Session accessToken (set by auth callback from MetaAccount or TeamMember)
        if (!cronOk && (session as any)?.accessToken) {
            fbToken = (session as any).accessToken
        }

        // 2. MetaAccount (primary - Account → Team)
        if (!fbToken && (user as any)?.metaAccount?.accessToken) {
            try {
                const { decryptToken } = await import('@/lib/services/metaClient')
                fbToken = decryptToken((user as any).metaAccount.accessToken)
            } catch {
                fbToken = (user as any).metaAccount.accessToken
            }
        }

        // 3. NextAuth Facebook account
        if (!fbToken && facebookAccount?.access_token) {
            fbToken = facebookAccount.access_token as string
        }

        // 4. Team members' tokens (when user is team owner)
        if (!fbToken && (user as any)?.teamMembers?.length) {
            const memberWithToken = (user as any).teamMembers.find((m: any) => m.accessToken)
            if (memberWithToken?.accessToken) {
                fbToken = memberWithToken.accessToken
            }
        }

        // 5. Team owner's token (when current user is a team member)
        if (!fbToken && user?.email) {
            const memberRecord = await prisma.teamMember.findFirst({
                where: { memberEmail: user.email }
            })
            if (memberRecord?.userId) {
                const teamOwner = await prisma.user.findUnique({
                    where: { id: memberRecord.userId },
                    include: {
                        metaAccount: { select: { accessToken: true } },
                        accounts: { where: { provider: 'facebook' } },
                        teamMembers: { select: { accessToken: true } }
                    }
                })
                if (teamOwner?.metaAccount?.accessToken) {
                    try {
                        const { decryptToken } = await import('@/lib/services/metaClient')
                        fbToken = decryptToken(teamOwner.metaAccount.accessToken)
                    } catch {
                        fbToken = teamOwner.metaAccount.accessToken
                    }
                }
                if (!fbToken && teamOwner?.accounts?.length) {
                    const fbAcc = teamOwner.accounts.find((a: any) => a.provider === 'facebook')
                    if (fbAcc?.access_token) fbToken = fbAcc.access_token as string
                }
                if (!fbToken && (teamOwner as any)?.teamMembers?.length) {
                    const memberWithToken = (teamOwner as any).teamMembers.find((m: any) => m.accessToken)
                    if (memberWithToken?.accessToken) fbToken = memberWithToken.accessToken
                }
            }
        }

        if (!fbToken) {
            return NextResponse.json({
                error: 'Facebook Ad Token missing. Please connect your Facebook/Meta account in Account → Team. If already connected, try signing out and signing in again.'
            }, { status: 400 })
        }

        // Refresh Google Token
        const googleTokens = await refreshAccessToken(googleAccount.refresh_token)

        // Update access token in DB
        if (googleTokens.access_token) {
            await prisma.account.update({
                where: { id: googleAccount.id },
                data: {
                    access_token: googleTokens.access_token,
                    expires_at: googleTokens.expiry_date ? Math.floor(googleTokens.expiry_date / 1000) : undefined,
                    refresh_token: googleTokens.refresh_token || undefined // Update if new one provided
                }
            })
        }

        const googleClient = getGoogleSheetsClient(googleTokens.access_token!)

        // Fetch Ad Data
        let accountIds: string[] = []
        try {
            if (Array.isArray(config.accountIds)) {
                accountIds = config.accountIds
            } else if (typeof config.accountIds === 'string') {
                accountIds = JSON.parse(config.accountIds)
            }
        } catch (e) {
            console.error('Error parsing accountIds:', e)
            accountIds = []
        }

        if (!accountIds || accountIds.length === 0) {
            return NextResponse.json({ error: 'No accounts selected' }, { status: 400 })
        }

        // Cap account IDs to reduce Meta API quota (200+ users)
        const MAX_ACCOUNTS_PER_EXPORT = 10
        if (accountIds.length > MAX_ACCOUNTS_PER_EXPORT) {
            console.warn(`[Export] Capping ${accountIds.length} accounts to ${MAX_ACCOUNTS_PER_EXPORT} for Meta quota`)
            accountIds = accountIds.slice(0, MAX_ACCOUNTS_PER_EXPORT)
        }

        let data: any[] = []

        // Insight-dependent fields - only fetch insights API when mapping needs them (saves ~50% Meta quota)
        const mapping = typeof config.columnMapping === 'string' ? JSON.parse(config.columnMapping) : config.columnMapping
        const insightFields = ['reach', 'impressions', 'spend', 'postEngagements', 'newMessagingContacts', 'clicks', 'costPerResult', 'results', 'costPerNewMessagingContact', 'frequency', 'ctr', 'cpc', 'cpm', 'videoPlays', 'videoP25Watched', 'videoP50Watched', 'videoP75Watched', 'videoP95Watched', 'videoP100Watched', 'videoAvgTimeWatched', 'video3SecWatched']
        const mappedFieldNames = (m: Record<string, string> | null | undefined): string[] => {
            if (!m || typeof m !== 'object') return []
            const entries = Object.entries(m)
            const keysLookLikeCols = entries.every(([k]) => /^[A-Z]{1,2}$/i.test(k))
            return keysLookLikeCols ? entries.map(([, v]) => v).filter(Boolean) : Object.keys(m)
        }
        // Always fetch insights for campaigns/adsets/ads - user needs Reach, Spend, etc.
        const mappedFields = mappedFieldNames(mapping)
        const needsInsights = mappedFields.length === 0 || mappedFields.some((f: string) => insightFields.includes(f))

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        const BATCH_SIZE = 2 // Run 2 accounts in parallel
        const { MetaQuotaDelays } = await import('@/lib/meta-quota-config');
        const DELAY_MS = MetaQuotaDelays.EXPORT_BATCH_DELAY_MS; // Throttle for Meta rate limit (500+ users)

        if (config.dataType === 'accounts') {
            const allAccounts = await getAdAccounts(fbToken)
            data = allAccounts.filter((acc: any) => {
                const idWithoutPrefix = acc.id.replace('act_', '')
                return accountIds.some(id => id.replace('act_', '') === idWithoutPrefix)
            })
        } else {
            const mergeInsights = (items: any[], insights: any[], level: string, onlyWithStats: boolean) => {
                const keyField = level === 'campaign' ? 'campaign_id' : level === 'adset' ? 'adset_id' : 'ad_id'
                const insightsMap = new Map<string, any>()
                insights.forEach((i: any) => {
                    const k = (i[keyField] || i.id || '').toString().replace(/^act_/, '')
                    if (k) {
                        insightsMap.set(k, i)
                        insightsMap.set('act_' + k, i)
                    }
                })
                const merged = items.map(item => {
                    const rawKey = (item.id || '').toString()
                    const key = rawKey.replace(/^act_/, '')
                    const insight = insightsMap.get(key) || insightsMap.get(rawKey) || insightsMap.get('act_' + key)
                    return { ...item, ...(insight || {}) }
                })
                const filtered = onlyWithStats ? merged.filter(item => hasInsightData(item, level)) : merged
                if (items.length > 0 && filtered.length === 0 && merged.length > 0) {
                    console.warn('[Export] All items filtered out by hasInsightData. Sample merged item:', JSON.stringify({
                        id: merged[0]?.id,
                        reach: merged[0]?.reach,
                        impressions: merged[0]?.impressions,
                        spend: merged[0]?.spend,
                        clicks: merged[0]?.clicks,
                        videoPlays: merged[0]?.videoPlays
                    }))
                }
                return filtered
            }
            const hasInsightData = (item: any, _level: string) => {
                const num = (v: any) => (v === '' || v === null || v === undefined) ? 0 : Math.max(0, parseFloat(String(v)) || 0)
                const hasReach = num(item.reach) > 0 || num(item.impressions) > 0 || num(item.spend) > 0
                const hasClicks = num(item.clicks) > 0
                const hasActions = num(item.postEngagements) > 0 || num(item.newMessagingContacts) > 0
                const hasVideo = num(item.videoPlays) > 0 || num(item.videoP25Watched) > 0 || num(item.videoP50Watched) > 0 ||
                    num(item.videoP75Watched) > 0 || num(item.videoP95Watched) > 0 || num(item.videoP100Watched) > 0 ||
                    num(item.video3SecWatched) > 0 || num(item.videoAvgTimeWatched) > 0
                return hasReach || hasClicks || hasActions || hasVideo
            }

            // dateRange: from frontend (manual) or from config.exportInterval (cron) or today
            let dateRange = body.dateRange
            if (!dateRange?.from || !dateRange?.to) {
                const today = new Date()
                const intervalHours = config.exportInterval ?? 24
                const fromDate = new Date(today)
                fromDate.setHours(fromDate.getHours() - intervalHours)
                dateRange = {
                    from: fromDate.toISOString().slice(0, 10),
                    to: today.toISOString().slice(0, 10),
                }
            }
            console.log('[Export] dateRange:', dateRange, 'dataType:', config.dataType, 'accountIds:', accountIds?.length)

            const getAccountIdWithPrefix = (id: string) => id.startsWith('act_') ? id : `act_${id}`

            const accounts = await getAdAccounts(fbToken)
            const accountMap = new Map(accounts.map((a: any) => [a.id, a.name]))

            const fetchAccountData = async (id: string) => {
                const accountId = getAccountIdWithPrefix(id)
                const rawId = id.replace(/^act_/, '')
                const accountName = accountMap.get(id) || accountMap.get(`act_${rawId}`) || accountMap.get(rawId) || ''

                if (config.dataType === 'campaigns') {
                    const [items, insights] = needsInsights
                        ? await Promise.all([getCampaignsWithDeliveryStatus(fbToken, accountId, dateRange), getInsights(fbToken, accountId, 'campaign', dateRange)])
                        : [await getCampaignsWithDeliveryStatus(fbToken, accountId, dateRange), []]
                    const merged = needsInsights ? mergeInsights(items, insights, 'campaign', true) : items
                    return merged.map((item: any) => ({ ...item, accountName }))
                } else if (config.dataType === 'adsets') {
                    const [items, insights] = needsInsights
                        ? await Promise.all([getAdSetsWithDeliveryStatus(fbToken, accountId), getInsights(fbToken, accountId, 'adset', dateRange)])
                        : [await getAdSetsWithDeliveryStatus(fbToken, accountId), []]
                    const merged = needsInsights ? mergeInsights(items, insights, 'adset', true) : items
                    return merged.map((item: any) => ({ ...item, accountName }))
                } else {
                    const [items, insights] = needsInsights
                        ? await Promise.all([getAds(fbToken, accountId, undefined, undefined, undefined), getInsights(fbToken, accountId, 'ad', dateRange)])
                        : [await getAds(fbToken, accountId, undefined, undefined, undefined), []]
                    const merged = needsInsights ? mergeInsights(items, insights, 'ad', true) : items
                    return merged.map((item: any) => ({ ...item, accountName }))
                }
            }

            // Process accounts in batches (parallel within batch, delay between batches)
            for (let i = 0; i < accountIds.length; i += BATCH_SIZE) {
                if (i > 0) await delay(DELAY_MS)
                const batch = accountIds.slice(i, i + BATCH_SIZE)
                const results = await Promise.all(batch.map(fetchAccountData))
                results.forEach(chunk => data.push(...chunk))
            }
        }

        if (data.length === 0) {
            const hint = config.dataType === 'ads' || config.dataType === 'campaigns' || config.dataType === 'adsets'
                ? ' (Check console for [Export] logs. Try selecting a different date or ensure ads have delivery/impressions for the selected date.)'
                : ''
            return NextResponse.json({ message: `No data to export${hint}`, count: 0 })
        }

        // Prepare Rows
        const now = new Date()
        const rows: string[][] = []

        // Determine date string to use: from dateRange if available (Manual export), otherwise today (Auto export)
        let dateStr = ''
        if (body.dateRange && body.dateRange.from) {
            const [y, m, d] = body.dateRange.from.split('-')
            dateStr = `${d}/${m}/${y}`
        } else {
            dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
        }

        // Normalize mapping: expect fieldKey->columnLetter (e.g. {date:'A', id:'B'})
        // If stored as columnLetter->fieldKey (e.g. {A:'date', B:'id'}), invert it
        const isColumnLetter = (k: string) => /^[A-Z]{1,2}$/i.test(k)
        let normalizedMapping: Record<string, string> = {}
        if (mapping && typeof mapping === 'object' && Object.keys(mapping).length > 0) {
            const entries = Object.entries(mapping)
            const keysLookLikeColumns = entries.every(([k]) => isColumnLetter(k))
            if (keysLookLikeColumns) {
                entries.forEach(([col, field]) => { if (typeof field === 'string' && field !== 'skip' && field !== 'empty') normalizedMapping[field] = col })
            } else {
                normalizedMapping = mapping as Record<string, string>
            }
        }
        const sheetCols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
        const defaultMapping: Record<string, string> = {}
        if (config.dataType === 'ads') {
            // A=Date, B=AD ID, C=Skip, D=Account Name, E=Skip, F=Reach, G=Impression, H=Engagement, I=Clicks, J=Message, K=Cost, L=Skip, M-T=Video stats
            if (config.includeDate) defaultMapping['date'] = 'A'
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
        } else {
            if (config.includeDate) defaultMapping['date'] = 'A'
            const cols = ['id', 'name', 'reach', 'impressions', 'clicks', 'spend', 'results', 'costPerResult', 'status', 'accountName', 'campaignName', 'adsetName']
            cols.forEach((k, i) => { defaultMapping[k] = sheetCols[config.includeDate ? i + 1 : i] || 'A' })
        }
        const effectiveMapping = Object.keys(normalizedMapping).length > 0 ? normalizedMapping : defaultMapping

        console.log('Column Mapping (effective):', effectiveMapping)
        console.log('Include Date:', config.includeDate)

        // Normalize raw Facebook API fields to column mapping keys (camelCase, nested -> flat)
        const normalizeItemForExport = (raw: any): Record<string, any> => {
            const item = { ...raw }
            // daily_budget / lifetime_budget (API returns in cents)
            if (raw.daily_budget != null) item.dailyBudget = parseFloat(raw.daily_budget) / 100
            if (raw.lifetime_budget != null) item.lifetimeBudget = parseFloat(raw.lifetime_budget) / 100
            if (!item.dailyBudget && item.lifetimeBudget) item.dailyBudget = item.lifetimeBudget
            // budget = dailyBudget or lifetimeBudget for "budget" column
            item.budget = item.dailyBudget ?? item.lifetimeBudget ?? raw.daily_budget ? parseFloat(raw.daily_budget) / 100 : raw.lifetime_budget ? parseFloat(raw.lifetime_budget) / 100 : null
            // Nested campaign/adset names
            item.campaignName = raw.campaign?.name ?? raw.campaign_name ?? ''
            item.adsetName = raw.adset?.name ?? raw.adset_name ?? ''
            // delivery = effective_status (or status)
            item.delivery = raw.effective_status ?? raw.status ?? ''
            // schedule = start_time - end_time/stop_time
            const start = raw.start_time || raw.startTime
            const end = raw.end_time ?? raw.stop_time ?? raw.endTime ?? raw.stopTime
            if (start || end) {
                const fmt = (s: string) => {
                    if (!s) return ''
                    const d = new Date(s)
                    return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                }
                item.schedule = [fmt(start), fmt(end)].filter(Boolean).join(' – ')
            } else {
                item.schedule = ''
            }
            // results = newMessagingContacts || postEngagements
            const resultsVal = raw.newMessagingContacts ?? raw.postEngagements ?? 0
            item.results = resultsVal
            // costPerResult = costPerNewMessagingContact or cost_per_action_type or spend/results
            const spendVal = parseFloat(raw.spend || 0)
            const cpaVal = raw.costPerNewMessagingContact ?? raw.cost_per_action_type?.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value
            item.costPerResult = cpaVal != null ? parseFloat(String(cpaVal)) : (resultsVal > 0 ? spendVal / resultsVal : 0)
            // Accounts: status, timezone, spend (amount_spent from ad account is in cents)
            if (config.dataType === 'accounts') {
                item.status = raw.account_status ?? raw.status ?? ''
                item.timezone = raw.timezone_name ?? raw.timezone ?? ''
                item.spend = raw.amount_spent != null ? parseFloat(raw.amount_spent) / 100 : raw.spend
            } else {
                // Campaigns/AdSets/Ads: spend from Insights API is already in main currency (decimal)
                if (raw.spend != null) item.spend = parseFloat(raw.spend)
            }
            // Ads: imageUrl from creative
            if (raw.creative) {
                item.imageUrl = raw.creative.image_url ?? raw.creative.thumbnail_url ?? ''
            }
            return item
        }

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const item = data[rowIndex]
            const normalized = normalizeItemForExport(item)
            normalized.index = rowIndex + 1

            // Calculate the maximum column index from mapping
            let maxColIndex = 0
            Object.values(effectiveMapping).forEach((colLetter) => {
                if (colLetter !== 'skip') {
                    const colIndex = getColumnIndex(colLetter as string)
                    if (colIndex > maxColIndex) maxColIndex = colIndex
                }
            })

            // Add buffer for safety
            maxColIndex = Math.max(maxColIndex + 1, 26)

            const rowData = new Array(maxColIndex).fill('')

            // Backwards compat: if includeDate but no 'date' in mapping, put date in column A
            if (config.includeDate && !effectiveMapping.date) {
                rowData[0] = dateStr
            }

            // Numeric keys: send as number type to avoid apostrophe (RAW stores strings with ')
            const numericKeys = ['reach', 'impressions', 'postEngagements', 'clicks', 'newMessagingContacts', 'spend', 'budget', 'dailyBudget', 'spendCap', 'costPerNewMessagingContact', 'costPerMessage', 'costPerResult', 'videoPlays', 'video3SecWatched', 'videoP25Watched', 'videoP50Watched', 'videoP75Watched', 'videoP95Watched', 'videoP100Watched']

            Object.entries(effectiveMapping).forEach(([key, colLetter]) => {
                if (colLetter === 'skip') return
                const colIndex = getColumnIndex(colLetter as string)
                if (colIndex >= 0 && colIndex < maxColIndex) {
                    let value = key === 'date' ? dateStr : normalized[key] ?? item[key]
                    if (key === 'videoAvgTimeWatched') {
                        const val = value ? parseFloat(value) : 0
                        if (val === 0) {
                            value = '00.00'
                        } else {
                            const m = Math.floor(val / 60)
                            const s = Math.floor(val % 60)
                            value = `${String(m).padStart(2, '0')}.${String(s).padStart(2, '0')}`
                        }
                    } else if (['spend', 'budget', 'dailyBudget', 'spendCap', 'costPerNewMessagingContact', 'costPerMessage', 'costPerResult'].includes(key) && value != null && value !== '') {
                        value = parseFloat(value).toFixed(2)
                    }

                    let cellValue: string | number = (value != null && value !== '') ? String(value) : ''
                    // Send numbers as number type - RAW stores strings with apostrophe, numbers without
                    if (numericKeys.includes(key) && cellValue !== '' && !isNaN(parseFloat(cellValue))) {
                        cellValue = parseFloat(cellValue)
                    }
                    rowData[colIndex] = cellValue
                }
            })

            // Keep the full row to maintain column alignment
            rows.push(rowData)
        }

        console.log('Total rows to export:', rows.length)

        if (rows.length === 0) {
            return NextResponse.json({ message: 'No data to export (all filtered out)', count: 0 })
        }

        // Ensure we have spreadsheetId (fallback: extract from URL)
        const spreadsheetId = config.spreadsheetId || (() => {
            const match = (config.spreadsheetUrl || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
            return match ? match[1] : null
        })()
        if (!spreadsheetId) {
            return NextResponse.json({ error: 'Invalid Google Sheets URL - could not extract spreadsheet ID' }, { status: 400 })
        }

        // Write to Google Sheets
        try {
            if (config.appendMode) {
                const existingData = await googleClient.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${config.sheetName}!A:A`
                })
                const lastRow = existingData.data.values?.length || 0
                const nextRow = lastRow + 1
                console.log('Writing to row:', nextRow, 'rows:', rows.length)

                await googleClient.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${config.sheetName}!A${nextRow}`,
                    valueInputOption: 'USER_ENTERED', // USER_ENTERED parses values - prevents apostrophe (RAW stores strings with ')
                    requestBody: { values: rows }
                })
            } else {
                try {
                    await googleClient.spreadsheets.values.clear({
                        spreadsheetId,
                        range: `${config.sheetName}!A:Z`
                    })
                } catch {
                    /* sheet may be empty */
                }
                await googleClient.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${config.sheetName}!A1`,
                    valueInputOption: 'USER_ENTERED', // USER_ENTERED parses values - prevents apostrophe (RAW stores strings with ')
                    requestBody: { values: rows }
                })
            }
        } catch (sheetsError: any) {
            const msg = sheetsError?.message || String(sheetsError)
            console.error('Google Sheets write error:', msg)
            if (msg.includes('404') || msg.includes('not found')) {
                return NextResponse.json({ error: `Sheet "${config.sheetName}" not found. Check the sheet name in your Google Spreadsheet.` }, { status: 400 })
            }
            if (msg.includes('403') || msg.includes('permission')) {
                return NextResponse.json({ error: 'Permission denied. Ensure the Google account has edit access to the spreadsheet.' }, { status: 403 })
            }
            return NextResponse.json({ error: `Failed to write to Google Sheets: ${msg}` }, { status: 500 })
        }

        // Update status
        await (prisma as any).exportConfig.update({
            where: { id: config.id },
            data: {
                lastExportAt: now,
                lastExportStatus: 'success',
                lastExportError: null
            }
        })

        const { ipAddress, userAgent } = getRequestMetadata(request)
        await createAuditLog({
            userId,
            action: 'EXPORT_GOOGLE_SHEET_TRIGGER',
            entityId: config.id,
            details: { configName: config.name, count: rows.length, dataType: config.dataType, triggeredBy: cronOk ? 'cron' : 'manual' },
            ipAddress,
            userAgent,
        })

        return NextResponse.json({ success: true, count: rows.length })

    } catch (error: any) {
        console.error('Manual export failed:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
