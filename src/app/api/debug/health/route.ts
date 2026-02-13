import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Check environment variables (mask sensitive data)
        const envCheck = {
            NODE_ENV: process.env.NODE_ENV,
            NEXTAUTH_URL: process.env.NEXTAUTH_URL,
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✓ Set' : '✗ Missing',
            DATABASE_URL: process.env.DATABASE_URL ? '✓ Set' : '✗ Missing',
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing',
            GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing',
        };

        // Test database connection
        let dbStatus = 'Unknown';
        let userCount = 0;
        try {
            await prisma.$connect();
            userCount = await prisma.user.count();
            dbStatus = '✓ Connected';
        } catch (dbError: any) {
            dbStatus = `✗ Failed: ${dbError.message}`;
        } finally {
            await prisma.$disconnect();
        }

        return NextResponse.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: envCheck,
            database: {
                status: dbStatus,
                userCount: dbStatus === '✓ Connected' ? userCount : null,
            },
            warnings: [
                !process.env.NEXTAUTH_SECRET && 'NEXTAUTH_SECRET is missing',
                !process.env.DATABASE_URL && 'DATABASE_URL is missing',
                process.env.NODE_ENV !== 'production' && 'NODE_ENV is not set to production',
            ].filter(Boolean),
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'ERROR',
            error: error.message,
        }, { status: 500 });
    }
}
