import { google } from 'googleapis'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://adser.net'}/api/auth/google/callback`

export const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
)

export const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]

export function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Important for refresh token
        scope: SCOPES,
        prompt: 'consent' // Force consent to ensure we get a refresh token
    })
}

export async function getTokens(code: string) {
    const { tokens } = await oauth2Client.getToken(code)
    return tokens
}

export async function refreshAccessToken(refreshToken: string) {
    oauth2Client.setCredentials({
        refresh_token: refreshToken
    })
    const { credentials } = await oauth2Client.refreshAccessToken()
    return credentials
}

export function getGoogleSheetsClient(accessToken: string) {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    return google.sheets({ version: 'v4', auth })
}
