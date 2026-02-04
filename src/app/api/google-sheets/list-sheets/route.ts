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
        const { spreadsheetUrl } = await request.json()

        if (!spreadsheetUrl) {
            return NextResponse.json({ error: 'Spreadsheet URL is required' }, { status: 400 })
        }

        // Extract Spreadsheet ID
        const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
        const spreadsheetId = match ? match[1] : null

        if (!spreadsheetId) {
            return NextResponse.json({ error: 'Invalid Google Sheets URL' }, { status: 400 })
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
        // NOTE: Standard NextAuth google provider might not return refresh token unless forced.
        // Also user might need to re-login to get permissions if they didn't grant scope.

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

        // Fetch Spreadsheet Details
        const response = await googleClient.spreadsheets.get({
            spreadsheetId
        })

        const sheets = response.data.sheets?.map(sheet => ({
            title: sheet.properties?.title,
            sheetId: sheet.properties?.sheetId
        })) || []

        const spreadsheetName = response.data.properties?.title || 'Google Sheets'

        return NextResponse.json({ sheets, spreadsheetId, spreadsheetName })

    } catch (error: any) {
        console.error('Error fetching sheets:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch sheets' }, { status: 500 })
    }
}
