import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from '@/lib/google-auth'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get user's Google account (same pattern as picker-token)
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                accounts: { where: { provider: 'google' } },
            },
        })

        const googleAccount = user?.accounts[0]
        if (!googleAccount?.refresh_token) {
            return NextResponse.json(
                { error: 'Google Account not connected. Please sign in with Google.' },
                { status: 400 }
            )
        }

        // Refresh access token
        const tokens = await refreshAccessToken(googleAccount.refresh_token)
        if (!tokens.access_token) {
            return NextResponse.json(
                { error: 'Failed to get Google access token. Please sign in again.' },
                { status: 500 }
            )
        }

        // Set up OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        )
        oauth2Client.setCredentials({
            access_token: tokens.access_token,
        })

        // Initialize Drive API
        const drive = google.drive({ version: 'v3', auth: oauth2Client })

        // List only Google Sheets files (mimeType filter)
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
            fields: 'files(id, name, modifiedTime, iconLink, webViewLink)',
            orderBy: 'modifiedTime desc',
            pageSize: 50, // Limit to 50 most recent spreadsheets
        })

        const spreadsheets = response.data.files?.map(file => ({
            id: file.id,
            name: file.name,
            modifiedTime: file.modifiedTime,
            iconLink: file.iconLink,
            webViewLink: file.webViewLink,
        })) || []

        return NextResponse.json({ spreadsheets })
    } catch (error: any) {
        console.error('Error listing spreadsheets:', error)

        // Handle token expiration
        if (error.code === 401 || error.message?.includes('invalid_grant')) {
            return NextResponse.json({ error: 'Google token expired. Please reconnect.' }, { status: 401 })
        }

        return NextResponse.json({ error: error.message || 'Failed to list spreadsheets' }, { status: 500 })
    }
}
