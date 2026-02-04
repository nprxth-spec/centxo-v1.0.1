/**
 * GET/POST /api/ads/spending-limit
 * Manage spending limits for Ad Accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { decryptToken } from '@/lib/services/metaClient';
import { toBasicUnits, fromBasicUnits } from '@/lib/currency-utils';
import { prisma } from '@/lib/prisma';

// Input validation schema
const spendingLimitSchema = z.object({
    accountId: z.string().min(1, "Account ID is required"),
    action: z.enum(['change', 'reset', 'delete']),
    newLimit: z.string().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get access token - try multiple sources
        let accessToken: string | null = null;
        const metaAccount = await prisma.metaAccount.findUnique({
            where: { userId: session.user.id },
            select: { accessToken: true },
        });
        
        // Decrypt MetaAccount token if exists
        if (metaAccount?.accessToken) {
            try {
                accessToken = decryptToken(metaAccount.accessToken);
                console.log('[spending-limit] MetaAccount token: decrypted successfully');
            } catch (e) {
                console.error('[spending-limit] Failed to decrypt MetaAccount token:', e);
            }
        } else {
            console.log('[spending-limit] MetaAccount token: not found');
        }

        if (!accessToken) {
            const facebookAccount = await prisma.account.findFirst({
                where: { userId: session.user.id, provider: 'facebook' },
                select: { access_token: true },
            });
            accessToken = facebookAccount?.access_token || null;
            console.log('[spending-limit] Account token:', accessToken ? 'found' : 'not found');
        }

        if (!accessToken) {
            accessToken = (session as any).accessToken || null;
            console.log('[spending-limit] Session token:', accessToken ? 'found' : 'not found');
        }

        if (!accessToken) {
            console.log('[spending-limit] No access token found');
            return NextResponse.json({ error: 'Facebook not connected' }, { status: 400 });
        }

        const body = await request.json();
        console.log('[spending-limit] Request:', body);

        // Validate input
        const validationResult = spendingLimitSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json({
                error: 'Invalid input',
                details: validationResult.error.issues
            }, { status: 400 });
        }

        const { accountId, action, newLimit } = validationResult.data;

        // Get account currency first
        const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
        const currencyResponse = await fetch(
            `https://graph.facebook.com/v22.0/${formattedAccountId}?fields=currency&access_token=${accessToken}`
        );
        const currencyData = await currencyResponse.json();
        const currency = currencyData.currency || 'USD';

        const apiUrl = `https://graph.facebook.com/v22.0/${formattedAccountId}`;
        console.log('[spending-limit] Account ID:', formattedAccountId);
        console.log('[spending-limit] Currency:', currency);
        console.log('[spending-limit] Action:', action);
        console.log('[spending-limit] New limit:', newLimit);

        let updateParams: Record<string, string> = { access_token: accessToken };

        switch (action) {
            case 'change':
                if (!newLimit || parseFloat(newLimit) <= 0) {
                    return NextResponse.json({ error: 'Invalid spending limit' }, { status: 400 });
                }
                // Convert to basic units based on currency (cents for USD, yen for JPY, etc.)
                const limitInBasicUnits = toBasicUnits(newLimit, currency);
                updateParams.spend_cap = limitInBasicUnits.toString();
                console.log('[spending-limit] Converting', newLimit, currency, 'to', limitInBasicUnits, 'basic units');
                break;

            case 'reset':
                // Reset means setting spend_cap_action to RESET
                // This resets the amount_spent counter back to 0, keeping the limit
                updateParams.spend_cap_action = 'reset';
                console.log('[spending-limit] Resetting spent amount to 0');
                break;

            case 'delete':
                // Facebook doesn't allow spend_cap = 0, it gets ignored
                // Instead, we need to use a workaround: set a very high limit
                // or inform user that Facebook doesn't support removing limits
                console.log('[spending-limit] Facebook does not support removing spend_cap');
                console.log('[spending-limit] Setting to very high limit (999999999) as workaround');
                
                // Convert to basic units for the currency
                const unlimitedValue = toBasicUnits(999999999, currency);
                updateParams.spend_cap = unlimitedValue.toString();
                break;

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Update the ad account using Facebook Graph API
        console.log('[spending-limit] Calling Facebook API:', apiUrl);
        console.log('[spending-limit] Parameters:', updateParams);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(updateParams).toString()
        });

        const result = await response.json();
        console.log('[spending-limit] Facebook response:', result);

        if (result.error) {
            console.error('[spending-limit] Facebook API Error:', result.error);
            return NextResponse.json({
                error: result.error.message || 'Facebook API error',
                code: result.error.code
            }, { status: 400 });
        }

        // Verify the change by fetching the account again
        const verifyResponse = await fetch(
            `${apiUrl}?fields=spend_cap,amount_spent,name&access_token=${accessToken}`
        );
        const verifyData = await verifyResponse.json();
        console.log('[spending-limit] Verification after update:', {
            name: verifyData.name,
            spend_cap: verifyData.spend_cap,
            amount_spent: verifyData.amount_spent
        });

        return NextResponse.json({
            success: true,
            message: `Spending limit ${action === 'change' ? 'updated' : action === 'reset' ? 'reset' : 'removed'} successfully`,
            data: result,
            verification: verifyData
        });

    } catch (error: any) {
        console.error('[spending-limit] Error:', error);
        console.error('[spending-limit] Stack:', error.stack);
        return NextResponse.json({
            error: error.message || 'Failed to update spending limit'
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get access token from MetaAccount table
        const metaAccount = await prisma.metaAccount.findUnique({
            where: { userId: session.user.id },
            select: { accessToken: true },
        });

        if (!metaAccount?.accessToken) {
            return NextResponse.json({ error: 'Facebook not connected' }, { status: 400 });
        }

        // Decrypt the token
        let accessToken: string;
        try {
            accessToken = decryptToken(metaAccount.accessToken);
        } catch (e) {
            console.error('[spending-limit GET] Failed to decrypt token:', e);
            return NextResponse.json({ error: 'Invalid access token' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        if (!accountId) {
            return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
        }

        // Ensure accountId has act_ prefix
        const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

        // Fetch account data from Facebook Graph API
        const apiUrl = `https://graph.facebook.com/v22.0/${formattedAccountId}`;
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'spend_cap,amount_spent,currency,name'
        });

        const response = await fetch(`${apiUrl}?${params.toString()}`);
        const accountData = await response.json();

        if (accountData.error) {
            return NextResponse.json({
                error: accountData.error.message || 'Facebook API error'
            }, { status: 400 });
        }

        const currency = accountData.currency || 'USD';

        return NextResponse.json({
            success: true,
            data: {
                id: accountId,
                name: accountData.name,
                spendCap: fromBasicUnits(accountData.spend_cap, currency),
                amountSpent: fromBasicUnits(accountData.amount_spent, currency) || 0,
                currency: currency,
            }
        });

    } catch (error: any) {
        console.error('Error fetching spending limit:', error);
        return NextResponse.json({ error: 'Failed to fetch spending limit' }, { status: 500 });
    }
}
