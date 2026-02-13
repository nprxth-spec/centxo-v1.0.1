import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')

        // Fetch User's MetaAccount to get Access Token
        const metaAccount = await prisma.metaAccount.findUnique({
            where: { userId: session.user.id }
        })

        if (!metaAccount || !metaAccount.accessToken) {
            // Fallback: Check NextAuth Account table for Facebook provider
            const fbAccount = await prisma.account.findFirst({
                where: {
                    userId: session.user.id,
                    provider: 'facebook'
                }
            })

            if (!fbAccount || !fbAccount.access_token) {
                return NextResponse.json({ data: [] })
            }

            // Use the fallback token
            const accessToken = fbAccount.access_token

            if (type === 'accounts') {
                const fields = 'id,name,currency,timezone_name,account_status,amount_spent,balance,created_time,disable_reason,end_advertiser,funding_source,funding_source_details,has_migrated_permissions,io_number,is_prepay_account,media_agency,min_campaign_group_spend_cap,min_daily_budget,offsite_pixels_tos_accepted,owner,partner,spend_cap,tax_id_type,tax_id_status,tax_id,timezone_id,timezone_offset_hours_utc,tos_accepted,user_role'

                const url = `https://graph.facebook.com/v19.0/me/adaccounts?fields=${fields}&limit=50&access_token=${accessToken}`

                const response = await fetch(url)
                const data = await response.json()

                if (data.error) {
                    console.error('FB API Error:', data.error)
                    // If fetching ads fails (e.g. scope issue), return empty but maybe generic error
                    return NextResponse.json({ error: data.error.message }, { status: 500 })
                }

                const accounts = data.data.map((acc: any) => ({
                    id: acc.id,
                    name: acc.name,
                    currency: acc.currency,
                    timezone: acc.timezone_name,
                    status: acc.account_status,
                    accountName: acc.name,
                }))

                return NextResponse.json({ data: accounts })
            }
        } else {
            // Logic for MetaAccount existing
            if (type === 'accounts') {
                // Fetch Ad Accounts from Facebook Graph API
                const fields = 'id,name,currency,timezone_name,account_status,amount_spent,balance,created_time,disable_reason,end_advertiser,funding_source,funding_source_details,has_migrated_permissions,io_number,is_prepay_account,media_agency,min_campaign_group_spend_cap,min_daily_budget,offsite_pixels_tos_accepted,owner,partner,spend_cap,tax_id_type,tax_id_status,tax_id,timezone_id,timezone_offset_hours_utc,tos_accepted,user_role'

                const url = `https://graph.facebook.com/v19.0/me/adaccounts?fields=${fields}&limit=50&access_token=${metaAccount.accessToken}`

                const response = await fetch(url)
                const data = await response.json()

                if (data.error) {
                    console.error('FB API Error:', data.error)
                    return NextResponse.json({ error: data.error.message }, { status: 500 })
                }

                const accounts = data.data.map((acc: any) => ({
                    id: acc.id,
                    name: acc.name,
                    currency: acc.currency,
                    timezone: acc.timezone_name,
                    status: acc.account_status,
                    // Add extra fields if needed by sheet export generic columns
                    accountName: acc.name, // generic mapper uses this
                }))

                return NextResponse.json({ data: accounts })
            }
        }


        return NextResponse.json({ data: [] })

    } catch (error) {
        console.error('Error fetching basic ads data:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
