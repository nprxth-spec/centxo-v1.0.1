
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const subs = await prisma.subscription.findMany();
    console.log('Found', subs.length, 'subscriptions');
    for (const sub of subs) {
        console.log('User ID:', sub.userId);
        console.log('Sub ID:', sub.id, 'Status:', sub.status, 'Expires:', sub.expiresAt);
        console.log('Selected Pages:', sub.selectedPageIds);
        console.log('Selected Ad Accounts:', sub.selectedAdAccountIds);
        console.log('---');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
