/**
 * One-time script: ล้าง adId/adName ของทุก conversation
 * ใช้เมื่อเคย assign ad เดียวให้ทุกแชทโดย mistake – หลังรันแล้วจะมีแค่แชทที่ Facebook ส่ง ad_id มา (webhook) จึงจะแสดงตัวอย่างโฆษณา
 *
 * Run: npx tsx scripts/clear-conversation-ad-ids.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.conversation.updateMany({
    data: { adId: null, adName: null },
  });
  console.log(`Cleared adId/adName for ${result.count} conversations.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
