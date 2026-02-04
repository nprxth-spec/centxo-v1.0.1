import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * R2 proxy route - DEPRECATED
 * Cloudflare R2 is no longer used. This route returns 410 Gone for backward compatibility.
 */
export async function GET() {
    return NextResponse.json(
        { error: 'R2 storage is no longer used. Media is now stored locally.' },
        { status: 410 }
    );
}
