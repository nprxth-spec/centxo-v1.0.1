
import { NextRequest, NextResponse } from 'next/server';
import { parseSignedRequest } from '@/lib/facebook';
import { createAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const signedRequest = formData.get('signed_request') as string;

        if (!signedRequest) {
            return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 });
        }

        // Decode and verify
        const data = parseSignedRequest(signedRequest, process.env.FACEBOOK_APP_SECRET || '');

        if (!data) {
            return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 });
        }

        const userId = data.user_id;
        // Facebook Requirement: "To ensure the security of user data, we require that you provide a URL where the user can check the status of their deletion request."

        // Generate a confirmation code / tracking ID
        const confirmationCode = `DEL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        console.log(`Received Data Deletion Request for FB User ID: ${userId}`);

        // Log the request (This is compliant - we log the REQUEST to delete)
        await createAuditLog({
            action: 'DATA_DELETION_REQUEST',
            entityType: 'DataDeletionRequest',
            details: { fbUserId: userId, confirmationCode },
            userId: 'SYSTEM'
        });

        // In a real scenario, you might mark the user for deletion in DB or delete immediately.
        // For compliance, we must return the URL and code.

        const statusUrl = `${process.env.NEXTAUTH_URL}/api/facebook/data-deletion/status?id=${confirmationCode}`;

        return NextResponse.json({
            url: statusUrl,
            confirmation_code: confirmationCode,
        });

    } catch (error) {
        console.error('Data Deletion Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
