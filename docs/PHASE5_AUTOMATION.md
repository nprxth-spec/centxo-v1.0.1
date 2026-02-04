# Phase 5: Automation & Smart Alerts

สรุปการพัฒนาระยะที่ 5 ต่อจาก Phase 1–4 (Security, Performance, UX, Quality).

**ก่อนรัน:** `npx prisma migrate dev --name add_automation_rules` แล้ว `npx prisma generate` ให้เรียบร้อย มิฉะนั้น `tsc` จะ error เรื่อง `automationRule` ใน Prisma client.

---

## 1. Overview

เพิ่มฟีเจอร์ **Auto Rules** และ **Creative Fatigue Radar** เป็น **หน้าใหม่** ไม่แก้หน้าเดิม

- **Auto Rules** — สร้างกฎเงื่อนไข (เช่น spend > X, messages < Y) เมื่อตรงตาม ให้ระบบ **หยุดแคมเปญ** อัตโนมัติ
- **Creative Fatigue Radar** — แสดงแอดที่อาจ “เหนื่อย” (CPA สูงขึ้น, CTR ลดลง) จากข้อมูล 7 วันล่าสุดเทียบ 7 วันก่อนหน้า

---

## 2. Database

### Model `AutomationRule`

เพิ่มใน `prisma/schema.prisma`:

- `id`, `userId`, `name`, `enabled`, `scope` (campaign | adset | ad)
- `adAccountIds` (JSON array ของ act_ IDs ว่าง = ใช้ทุกบัญชีที่รัน)
- `condition` (JSON: `{ metric, op, value }` เช่น spend, gt, 10)
- `action` (JSON: `{ type: 'pause' }`)
- `lastRunAt`, `lastResult`

### Migration

รันที่เครื่องคุณ:

```bash
npx prisma migrate dev --name add_automation_rules
npx prisma generate
```

บน **PowerShell** รันทีละคำสั่ง (อย่าใช้ `&&` — ไม่รองรับ)

#### ถ้าเจอ P3014 (Shadow database)

เมื่อ MySQL user **ไม่มีสิทธิ์ CREATE DATABASE** (เช่น managed/hosted DB ที่ 103.80.48.25) จะขึ้น:

```
Error: P3014 — Prisma Migrate could not create the shadow database.
User was denied access on the database `prisma_migrate_shadow_db_...`
```

**วิธีแก้:** ใช้ `db push` แทน migrate (อัปเดต schema โดยตรง ไม่ใช้ shadow DB, ไม่มี migration history):

```bash
npx prisma db push
npx prisma generate
```

หรือบน PowerShell รันทีละคำสั่ง จากโฟลเดอร์โปรเจค

- `db push` จะสร้าง/แก้ตาราง `AutomationRule` ให้ตรงกับ schema
- หลังจากนั้น Auto Rules ใช้งานได้ตามปกติ

---

## 3. APIs

### Automation Rules

| Method | Route | คำอธิบาย |
|--------|--------|----------|
| GET | `/api/automation/rules` | list rules ของ user |
| POST | `/api/automation/rules` | สร้าง rule |
| GET | `/api/automation/rules/[id]` | ดึง rule เดียว |
| PATCH | `/api/automation/rules/[id]` | อัปเดต (ชื่อ, enabled, condition, …) |
| DELETE | `/api/automation/rules/[id]` | ลบ rule |
| POST | `/api/automation/rules/run` | รันกฎ (body: `adAccountIds`, optional `ruleIds`) |

- **Condition:** metric = `spend` | `messages` | `impressions` | `reach` | `clicks` | `costPerMessage`; op = `gt` | `gte` | `lt` | `lte` | `eq`; value = number
- **Action:** ปัจจุบันรองรับ `pause` เท่านั้น
- **Run:** ดึง campaigns จาก Meta (ตามบัญชีที่ส่งมา) → ประเมิน condition → Pause แคมเปญที่ตรงตาม

### Creative Fatigue

- ไม่มี API ใหม่ ใช้ **`/api/ads`** สองช่วงเวลา (7 วันล่าสุด / 7 วันก่อนหน้า)
- หน้า **Creative Fatigue** fetch เองแล้ว merge + คำนวณ fatigue ฝั่ง client

---

## 4. หน้าใหม่

| หน้า | path | คำอธิบาย |
|------|------|----------|
| **Auto Rules** | `/tools/auto-rules` | สร้าง/แก้/ลบ rule, เปิด-ปิด, ปุ่ม Run now |
| **Creative Fatigue Radar** | `/tools/creative-fatigue` | ตารางแอด + สัญญาณ fatigue (CPA rising, CTR dropping, …) |

- ใช้ **AdAccountContext** สำหรับบัญชีที่เลือก (เช่น Run rules, โหลดแอด)
- รองรับ i18n (EN/TH) ผ่าน `tools.autoRules.*`, `tools.creativeFatigue.*`

---

## 5. โครงสร้างไฟล์ที่เพิ่ม/แก้

| ไฟล์ | การกระทำ |
|------|----------|
| `prisma/schema.prisma` | เพิ่ม model `AutomationRule` + relation ใน `User` |
| `src/lib/automation/tokens.ts` | helper สร้าง `TokenInfo[]` จาก session |
| `src/lib/automation/runner.ts` | helper ดึง campaigns จาก Meta, ประเมิน condition, pause |
| `src/app/api/automation/rules/route.ts` | GET, POST |
| `src/app/api/automation/rules/[id]/route.ts` | GET, PATCH, DELETE |
| `src/app/api/automation/rules/run/route.ts` | POST รัน rules |
| `src/app/(app)/tools/auto-rules/page.tsx` | หน้า Auto Rules |
| `src/app/(app)/tools/creative-fatigue/page.tsx` | หน้า Creative Fatigue |
| `src/components/app-sidebar.tsx` | เพิ่มเมนู Auto Rules, Creative Fatigue ใต้ Campaigns |
| `src/lib/messages.ts` | เพิ่ม keys สำหรับ auto rules + creative fatigue |

---

## 6. ความสมบูรณ์ (เพิ่มภายหลัง)

- **Auto Rules**: Setup hint (503 + migrate/generate), creating loading, run errors in toast, PATCH/DELETE details, empty state เมื่อ setup required
- **Creative Fatigue**: ปุ่ม Refresh, แสดง fetch error
- **A/B Creative Lab**: ปุ่ม Clear (ล้างฟอร์ม + ผลลัพธ์), i18n clear/cleared
- **Automation APIs**: [id] และ run ใช้ `getModel()` fallback, userId resolution, คืน `details` ใน error

## 7. ขั้นตอนถัดไป (แนะนำ)

1. รัน `npx prisma migrate dev` และ `npx prisma generate` ให้ครบ
2. ทดสอบ Auto Rules: สร้าง rule → เลือกบัญชี → Run now → ตรวจว่าแคมเปญที่ตรงเงื่อนไขถูก pause
3. ทดสอบ Creative Fatigue: เลือกบัญชีที่มีแอด → Refresh → ตรวจตารางและสัญญาณ fatigue
4. (Optional) ขยาย scope เป็น adset/ad หรือเพิ่ม action แบบ reduce budget ใน phase ถัดไป
