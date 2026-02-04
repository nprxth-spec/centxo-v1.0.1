-- ลบข้อมูล accounts และ users ทั้งหมดเพื่อเริ่มใหม่
-- WARNING: This will delete ALL users and accounts data!

-- ลบ campaigns และข้อมูลที่เกี่ยวข้องก่อน (ถ้ามี)
DELETE FROM `AuditLog`;
DELETE FROM `AdInsight`;
DELETE FROM `Ad`;
DELETE FROM `AdSetInsight`;
DELETE FROM `AdSet`;
DELETE FROM `CampaignInsight`;
DELETE FROM `Campaign`;
DELETE FROM `MetaAccount`;

-- ลบ accounts
DELETE FROM `Account`;

-- ลบ users
DELETE FROM `User`;

-- แสดงผลลัพธ์
SELECT 'All data cleared successfully!' as message;
