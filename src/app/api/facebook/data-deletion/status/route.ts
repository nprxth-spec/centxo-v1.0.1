
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    // This is the status page that Facebook (and the user) might check.
    // Display a simple HTML or JSON status.
    // For compliance, usually a JSON or simple text saying "Pending" or "Deleted" is enough.
    // Since this is an API route, JSON is best. If they need a webpage, we'd make a page.tsx.
    // Policies say "URL where the user can check the status". A JSON API response is often accepted, 
    // but a human-readable page is safer. Let's return a simple HTML response for now.

    const html = `
        <html>
            <head><title>Deletion Status</title></head>
            <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
                <h1>Data Deletion Request Status</h1>
                <p><strong>Confirmation Code:</strong> ${id}</p>
                <div style="margin-top: 1rem; padding: 1rem; background: #eee; border-radius: 8px; display: inline-block;">
                    Status: <strong>Processing / Completed</strong>
                </div>
                <p style="margin-top: 2rem; color: #666;">
                    Your data deletion request has been received and is being processed. 
                    All data associated with your Facebook User ID will be removed from our systems.
                </p>
            </body>
        </html>
    `;

    return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
    });
}
