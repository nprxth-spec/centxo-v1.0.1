const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to clear database...');

  try {
    // Delete in order to respect foreign key constraints

    console.log('Clearing messaging tables...');
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.pageSettings.deleteMany();

    console.log('Clearing automation and settings...');
    await prisma.automationRule.deleteMany();
    await prisma.exportConfig.deleteMany();
    await prisma.interestAudiencePreset.deleteMany();
    await prisma.iceBreakerTemplate.deleteMany();
    await prisma.automationRule.deleteMany(); // Duplicate check

    console.log('Clearing ads and insights...');
    await prisma.adInsight.deleteMany();
    await prisma.adSetInsight.deleteMany();
    await prisma.campaignInsight.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.decisionLog.deleteMany();

    await prisma.ad.deleteMany();
    await prisma.adSet.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.adCreative.deleteMany();
    await prisma.aIAnalysisLog.deleteMany();

    await prisma.metaAccount.deleteMany();
    await prisma.facebookInterest.deleteMany();

    console.log('Clearing user and team tables...');
    await prisma.teamMember.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();

    console.log('Database cleared successfully!');
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
