import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ isConnected: false }, { status: 401 })
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                accounts: {
                    where: { provider: 'google' }
                }
            }
        })

        const googleAccount = user?.accounts[0]

        if (googleAccount) {
            return NextResponse.json({
                isConnected: true,
                email: session.user.email, // Best guess if we declare it in session, else we might need to fetch from provider
                picture: session.user.image,
                // Checks specifically if we have refresh token (crucial for offline access)
                hasRefreshToken: !!googleAccount.refresh_token
            })
        }

        return NextResponse.json({ isConnected: false })

    } catch (error) {
        console.error('Error fetching google status:', error)
        return NextResponse.json({ isConnected: false }, { status: 500 })
    }
}
