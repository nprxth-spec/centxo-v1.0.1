import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken, getGoogleSheetsClient } from '@/lib/google-auth'

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { spreadsheetId, sheetName } = await request.json()

        if (!spreadsheetId || !sheetName) {
            return NextResponse.json({ error: 'Spreadsheet ID and sheet name are required' }, { status: 400 })
        }

        // Get User Tokens
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                accounts: {
                    where: { provider: 'google' }
                }
            }
        })

        const googleAccount = user?.accounts[0]

        if (!googleAccount) {
            return NextResponse.json({ error: 'Google Account not connected' }, { status: 400 })
        }

        if (!googleAccount.refresh_token) {
            return NextResponse.json({ error: 'Google Refresh Token missing' }, { status: 400 })
        }

        // Refresh Token
        const googleTokens = await refreshAccessToken(googleAccount.refresh_token)

        // Update DB if refreshed
        if (googleTokens.access_token) {
            await prisma.account.update({
                where: { id: googleAccount.id },
                data: {
                    access_token: googleTokens.access_token,
                    expires_at: googleTokens.expiry_date ? Math.floor(googleTokens.expiry_date / 1000) : undefined,
                    refresh_token: googleTokens.refresh_token || undefined
                }
            })
        }

        const googleClient = getGoogleSheetsClient(googleTokens.access_token!)

        // Fetch first row to detect columns (A1:Z1 - check up to 26 columns)
        const response = await googleClient.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:Z1`
        })

        const firstRow = response.data.values?.[0] || []
        // Count non-empty columns
        const columnCount = firstRow.filter(cell => cell && cell.toString().trim() !== '').length || 0

        // Generate column letters based on detected columns (minimum 5 columns if empty)
        const sheetColumns = [
            ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
            ...Array.from({ length: 26 }, (_, i) => 'A' + String.fromCharCode(65 + i))
        ]
        const detectedColumns = sheetColumns.slice(0, Math.max(columnCount, 5))

        return NextResponse.json({ 
            columns: detectedColumns,
            columnCount,
            firstRowValues: firstRow.slice(0, columnCount)
        })

    } catch (error: any) {
        console.error('Error fetching columns:', error)
        const msg = error?.message || ''
        if (msg.includes('Requested entity was not found') || error?.code === 404) {
            return NextResponse.json({
                error: 'Cannot access this spreadsheet. Please use "Select from Drive" to pick your spreadsheet.'
            }, { status: 403 })
        }
        return NextResponse.json({ error: msg || 'Failed to fetch columns' }, { status: 500 })
    }
}
