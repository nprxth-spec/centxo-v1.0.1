/**
 * Script to clear all data from the database
 * WARNING: This will delete ALL data from ALL tables!
 * 
 * Usage: npx tsx scripts/clear-database.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('⚠️  WARNING: This will delete ALL data from the database!');
  console.log('Starting database cleanup...\n');

  try {
    // Delete in order to respect foreign key constraints
    // Start with tables that have foreign keys pointing to them last

    console.log('Deleting Messages...');
    await prisma.message.deleteMany({});

    console.log('Deleting Conversations...');
    await prisma.conversation.deleteMany({});

    console.log('Deleting PageSettings...');
    await prisma.pageSettings.deleteMany({});

    console.log('Deleting InterestAudiencePreset...');
    await prisma.interestAudiencePreset.deleteMany({});

    console.log('Deleting IceBreakerTemplate...');
    await prisma.iceBreakerTemplate.deleteMany({});

    console.log('Deleting TeamMember...');
    await prisma.teamMember.deleteMany({});

    console.log('Deleting Subscription...');
    await prisma.subscription.deleteMany({});

    console.log('Deleting ExportConfig...');
    await prisma.exportConfig.deleteMany({});

    console.log('Deleting FacebookInterest...');
    await prisma.facebookInterest.deleteMany({});

    console.log('Deleting AuditLog...');
    await prisma.auditLog.deleteMany({});

    console.log('Deleting DecisionLog...');
    await prisma.decisionLog.deleteMany({});

    console.log('Deleting AdSetInsight...');
    await prisma.adSetInsight.deleteMany({});

    console.log('Deleting AdInsight...');
    await prisma.adInsight.deleteMany({});

    console.log('Deleting CampaignInsight...');
    await prisma.campaignInsight.deleteMany({});

    console.log('Deleting AIAnalysisLog...');
    await prisma.aIAnalysisLog.deleteMany({});

    console.log('Deleting AdCreative...');
    await prisma.adCreative.deleteMany({});

    console.log('Deleting Ad...');
    await prisma.ad.deleteMany({});

    console.log('Deleting AdSet...');
    await prisma.adSet.deleteMany({});

    console.log('Deleting Campaign...');
    await prisma.campaign.deleteMany({});

    console.log('Deleting AutomationRule...');
    await prisma.automationRule.deleteMany({});

    console.log('Deleting Session...');
    await prisma.session.deleteMany({});

    console.log('Deleting MetaAccount...');
    await prisma.metaAccount.deleteMany({});

    console.log('Deleting Account (OAuth)...');
    await prisma.account.deleteMany({});

    console.log('Deleting User...');
    await prisma.user.deleteMany({});

    console.log('\n✅ Database cleared successfully!');
  } catch (error) {
    console.error('\n❌ Error clearing database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearDatabase()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
