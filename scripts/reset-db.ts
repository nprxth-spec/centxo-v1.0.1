import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Starting database reset...');

        // Delete independent tables or non-cascading data first if needed
        await prisma.exportConfig.deleteMany({});
        console.log('Deleted ExportConfigs');

        await prisma.auditLog.deleteMany({});
        console.log('Deleted AuditLogs');

        // cascade deletes
        await prisma.user.deleteMany({});
        console.log('Deleted Users (and cascaded Accounts, Sessions, TeamMembers)');

        console.log('Database reset complete.');
    } catch (error) {
        console.error('Error resetting database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
