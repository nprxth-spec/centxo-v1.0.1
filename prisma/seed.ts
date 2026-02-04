
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Manually load envs since tsx/prisma might not pick up .env.local automatically
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
}
dotenv.config(); // fallback to .env

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        console.warn('⚠️  SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in environment. Skipping admin creation.');
        return;
    }

    const hashedPassword = await hash(adminPassword, 12);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            role: 'SUPER_ADMIN',
            password: hashedPassword, // Update password if env changes
        } as any,
        create: {
            email: adminEmail,
            name: 'Super Admin',
            role: 'SUPER_ADMIN',
            password: hashedPassword,
        } as any,
    });

    console.log(`✅ Super Admin configured: ${admin.email}`);
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
