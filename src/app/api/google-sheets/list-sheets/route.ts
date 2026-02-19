import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken, getGoogleSheetsClient } from '@/lib/google-auth'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Declare googleClient at function scope
    let googleClient: ReturnType<typeof getGoogleSheetsClient> | undefined

    try {
        const { spreadsheetUrl, spreadsheetId: idFromBody, pickerAccessToken } = await request.json()

        let spreadsheetId: string | null = idFromBody || null
        if (!spreadsheetId && spreadsheetUrl) {
            const match = String(spreadsheetUrl).match(/\/d\/([a-zA-Z0-9-_]+)/)
            spreadsheetId = match ? match[1] : null
        }

        if (!spreadsheetId) {
            return NextResponse.json({ error: 'Spreadsheet URL or ID is required' }, { status: 400 })
        }

        // When using drive.file scope with Google Picker:
        // - The file selected via Picker is automatically granted permission to the OAuth client
        // - We must use the SAME OAuth client's access token to access the file
        // - Since getGoogleSheetsClient now uses the correct CLIENT_ID and CLIENT_SECRET,
        //   the refresh token from the same OAuth client will work correctly

        // Get user and Google account
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                accounts: {
                    where: { provider: 'google' }
                }
            }
        })

        const googleAccount = user?.accounts[0]
        if (!googleAccount?.refresh_token) {
            return NextResponse.json({ error: 'Google Refresh Token missing' }, { status: 400 })
        }

        // When using drive.file scope with Google Picker:
        // - The file selected via Picker is automatically granted permission to the OAuth client
        // - We MUST use access token from the SAME OAuth client (same CLIENT_ID and CLIENT_SECRET)
        // - The picker token comes from picker-token endpoint which uses refreshAccessToken (same OAuth client)
        // - So both picker token and refresh token are from the same OAuth client

        // When using drive.file scope with Google Picker:
        // - The file selected via Picker is automatically granted permission to the OAuth client
        // - We MUST use access token from the SAME OAuth client (same CLIENT_ID and CLIENT_SECRET)
        // - The picker token comes from picker-token endpoint which uses refreshAccessToken (same OAuth client)
        // - So both picker token and refresh token are from the same OAuth client

        // Try picker token first if available (it's from the same OAuth client via picker-token endpoint)
        // If that fails, fall back to refresh token (also from the same OAuth client)
        let accessToken: string

        if (pickerAccessToken) {
            // Use picker token directly - it's from the same OAuth client and has permission
            console.log('Using picker access token directly (from same OAuth client)')
            accessToken = pickerAccessToken
        } else {
            // Refresh Token to get access token from the same OAuth client
            const googleTokens = await refreshAccessToken(googleAccount.refresh_token)
            if (!googleTokens.access_token) {
                return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 })
            }

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

            accessToken = googleTokens.access_token
        }

        console.log('Using access token:', {
            source: pickerAccessToken ? 'picker token (has file permission)' : 'refresh token (same OAuth client as Picker)',
            hasPickerToken: !!pickerAccessToken,
            pickerTokenLength: pickerAccessToken?.length,
            tokenLength: accessToken?.length,
            spreadsheetId,
            tokenPrefix: accessToken?.substring(0, 20) + '...',
            clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
            hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
            clientIdFull: process.env.GOOGLE_CLIENT_ID,
            appIdFromClientId: process.env.GOOGLE_CLIENT_ID?.split('-')[0]
        })

        // Fetch Spreadsheet Details
        // When using drive.file scope with Google Picker:
        // - If picker token is provided, use it directly (has permission)
        // - Otherwise, use refresh token from the same OAuth client (now with correct CLIENT_ID/SECRET)
        console.log('Fetching spreadsheet details for:', spreadsheetId, 'using', pickerAccessToken ? 'picker token' : 'refresh token')
        googleClient = getGoogleSheetsClient(accessToken)
        let response: any

        try {
            response = await googleClient.spreadsheets.get({
                spreadsheetId
            })

            // Process response will be done after catch block
        } catch (apiError: any) {
            const errorDetails = {
                message: apiError?.message,
                code: apiError?.code,
                status: apiError?.status,
                statusCode: apiError?.response?.status,
                statusText: apiError?.response?.statusText,
                errors: apiError?.errors,
                usedPickerToken: !!pickerAccessToken,
                hasRefreshToken: !!googleAccount?.refresh_token,
                spreadsheetId,
                clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...'
            }

            console.error('Google Sheets API error:', errorDetails)

            // Check if it's a permission error
            const isPermissionError = apiError?.code === 403 || apiError?.status === 403 ||
                apiError?.code === 404 || apiError?.status === 404 ||
                apiError?.message?.includes('insufficient permissions') ||
                apiError?.message?.includes('Permission denied')

            if (isPermissionError) {
                // If file was selected via Picker but still can't access, it might be a token mismatch issue
                if (pickerAccessToken) {
                    console.error('Permission error even with Picker token. Possible causes:', {
                        tokenMismatch: 'OAuth client mismatch',
                        fileNotGranted: 'File not properly granted to OAuth client',
                        tokenExpired: 'Picker token may have expired'
                    })
                }

                return NextResponse.json({
                    error: 'Cannot access this spreadsheet. Please make sure you selected it via "Select from Google Drive" button, or the file may not be accessible with the current permissions.',
                    details: pickerAccessToken ? 'File was selected via Picker but access denied. This may indicate an OAuth client configuration issue.' : 'Please use Google Picker to select the file.'
                }, { status: 403 })
            }

            // For other errors, re-throw to be handled by outer catch
            throw apiError
        }

        // Process the response if we got here successfully
        if (!response || !response.data) {
            console.error('No response data available')
            return NextResponse.json({
                error: 'Failed to fetch spreadsheet data. Please try again.'
            }, { status: 500 })
        }

        console.log('Spreadsheet response:', {
            hasSheets: !!response.data.sheets,
            sheetsCount: response.data.sheets?.length || 0,
            spreadsheetName: response.data.properties?.title
        })

        const sheets = (response.data.sheets || [])
            .map((sheet: any) => ({
                title: sheet.properties?.title,
                sheetId: sheet.properties?.sheetId
            }))
            .filter((sheet: any): sheet is { title: string; sheetId: number } =>
                !!sheet.title && sheet.sheetId !== undefined
            ) || []

        console.log('Filtered sheets:', sheets)

        if (sheets.length === 0) {
            return NextResponse.json({
                error: 'No sheets found in this spreadsheet. Please make sure the spreadsheet contains at least one sheet.'
            }, { status: 400 })
        }

        const spreadsheetName = response.data.properties?.title || 'Google Sheets'

        return NextResponse.json({ sheets, spreadsheetId, spreadsheetName })

    } catch (error: any) {
        console.error('Error fetching sheets:', {
            message: error?.message,
            code: error?.code,
            status: error?.status,
            stack: error?.stack
        })

        const msg = error?.message || ''
        const errorCode = error?.code || error?.status

        // Check for permission/access errors
        if (msg.includes('Requested entity was not found') ||
            errorCode === 404 ||
            msg.includes('insufficient permissions') ||
            msg.includes('Permission denied') ||
            errorCode === 403) {
            return NextResponse.json({
                error: 'Cannot access this spreadsheet. Please make sure you selected it via "Select from Drive" button, or the file may not be accessible with the current permissions.',
                details: 'The file may not have been properly granted permission to the OAuth client.'
            }, { status: 403 })
        }

        return NextResponse.json({
            error: msg || 'Failed to fetch sheets',
            details: errorCode ? `Error code: ${errorCode}` : undefined
        }, { status: 500 })
    }
}
