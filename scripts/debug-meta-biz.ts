
// This script simulates a request to the config route by importing the GET handler 
// or by just running a similar fetch if possible. 
// Since GET requires NextRequest/NextResponse and session context, it's hard to call directly.
// Instead, let's use the same logic as debug-db.ts but purely to fetch from Meta using the user's token 
// to see invalid permissions.

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

// Derive proper key using PBKDF2
const DERIVED_KEY = crypto.pbkdf2Sync(
    ENCRYPTION_KEY,
    'centxo-salt-v1',
    100000,
    32,
    'sha256'
);

const LEGACY_KEY = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));

function decrypt(encryptedToken: string): string {
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) return encryptedToken;

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    // Try new PBKDF2-derived key first
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', DERIVED_KEY, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        // Fallback to legacy key
        const decipher = crypto.createDecipheriv('aes-256-cbc', LEGACY_KEY, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

async function main() {
    // 1. Get user with active subscription
    const user = await prisma.user.findFirst({
        where: { email: 'admin@centxo.com' } // Adjust if known, else pick first with sub
    });

    // We already know from debug-db that the user ID is likely 'cmlic5e4v0000ucfop8lmmyl3' (the one with active sub)
    const targetUserId = 'cmlic5e4v0000ucfop8lmmyl3';
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) { console.log('User not found'); return; }

    console.log('Testing for user:', targetUser.email, targetUser.id);

    // 2. Get tokens
    const metaAccount = await prisma.metaAccount.findUnique({ where: { userId: targetUser.id } });
    let token = metaAccount?.accessToken ? decrypt(metaAccount.accessToken) : undefined;

    if (!token) {
        const fbAccount = await prisma.account.findFirst({
            where: { userId: targetUser.id, provider: 'facebook' }
        });
        token = fbAccount?.access_token || undefined;
    }

    if (!token) {
        console.log('No token found');
        return;
    }

    console.log('Token found (decrypted), fetching businesses...');

    // 3. Replicate the fetch logic from config/route.ts
    // Including owned_ad_accounts
    const bizFields = 'id,name,client_ad_accounts.limit(500){id,name,account_id},owned_ad_accounts.limit(500){id,name,account_id}';
    const url = `https://graph.facebook.com/v21.0/me/businesses?fields=${encodeURIComponent(bizFields)}&limit=500&access_token=${token}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.error) {
        console.error('Meta API Error:', json.error);
        return;
    }

    const businesses = json.data || [];
    console.log(`Found ${businesses.length} businesses`);

    let allAccounts: any[] = [];

    for (const b of businesses) {
        console.log(`- Business: ${b.name} (${b.id})`);
        const owned = b.owned_ad_accounts?.data || [];
        const client = b.client_ad_accounts?.data || [];
        console.log(`  Owned: ${owned.length}, Client: ${client.length}`);

        owned.forEach((a: any) => console.log(`    [OWNED] ${a.name} (${a.id})`));
        client.forEach((a: any) => console.log(`    [CLIENT] ${a.name} (${a.id})`));
        allAccounts.push(...owned, ...client);
    }

    console.log(`Total Accounts Found (Nested): ${allAccounts.length}`);

    // 4. Test explicit fetch for me/adaccounts
    console.log('\n--- Testing me/adaccounts ---');
    const adRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=name,account_id&limit=500&access_token=${token}`);
    const adJson = await adRes.json();
    const adData = adJson.data || [];
    console.log(`me/adaccounts found: ${adData.length}`);
    adData.forEach((a: any) => console.log(`  ${a.name} (${a.id})`));

    // 5. Test explicit fetch for Business 'Centxo' (688965275913220) client accounts
    console.log('\n--- Testing Centxo (688965275913220) explicit client_ad_accounts ---');
    const clientRes = await fetch(`https://graph.facebook.com/v21.0/688965275913220/client_ad_accounts?fields=name,account_id&limit=500&access_token=${token}`);
    const clientJson = await clientRes.json();
    const clientData = clientJson.data || [];
    console.log(`Explicit fetch found: ${clientData.length}`);
    clientData.forEach((a: any) => console.log(`  ${a.name} (${a.id})`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
