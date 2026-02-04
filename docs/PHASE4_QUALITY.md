# Phase 4: Quality & Reliability

สรุปการพัฒนาระยะที่ 4 หลัง Phase 1–3 (Security, Performance, UX).

---

## 1. Vitest + Unit tests

### ติดตั้ง

```bash
npm install
npm run test        # รันเทสครั้งเดียว
npm run test:watch  # โหมด watch
```

### เครื่องมือ

- **Vitest** (`vitest.config.mts`): environment `node`, resolve alias `@` → `src/`
- ไฟล์เทส: `src/**/*.test.ts`, `src/**/*.spec.ts`
- ไฟล์เทสถูก exclude จาก `tsconfig.json` เพื่อไม่ให้ `tsc` ต้องใช้ vitest

### ชุดเทสที่เพิ่ม

| ไฟล์ | สิ่งที่เทส |
|------|------------|
| `src/lib/validation.test.ts` | `formDataToObject`, `campaignCreateSchema`, `validateRequestBody`, `validateQueryParams`, `campaignsQuerySchema` |

- **formDataToObject:** คัดลอก string entries, ข้าม File/Blob, FormData ว่าง
- **campaignCreateSchema:** minimal valid, missing required, invalid objective, dailyBudget แปลง/ปฏิเสธ, count/placements/age แปลงและ clamp, manualIceBreakers parse, primaryText/headline max length

---

## 2. Error logging — Campaigns Create

### การเปลี่ยนแปลง

- **Catch สุดท้าย:** log `[campaigns/create] Error: <message>` และในโหมด development เพิ่ม stack
- **Meta AdSet failure:** `[campaigns/create] AdSet API error: <JSON>`
- **Meta Ad Creative failure (boost-post flow):** `[campaigns/create] Ad Creative API error: <JSON>`
- **Meta Ad failure (boost-post flow):** `[campaigns/create] Ad API error: <JSON>`
- **Meta Ad failure (main flow):** `[campaigns/create] Ad API error: <JSON>`

เดิมมี `[campaigns/create] Campaign API error` และ `[campaigns/create] Creative failed` อยู่แล้ว ได้จัดให้สอดคล้องและเพิ่มจุดที่ยังไม่ได้ log

---

## 3. สรุปไฟล์ที่แก้/เพิ่ม

| ไฟล์ | การกระทำ |
|------|----------|
| `package.json` | เพิ่ม `vitest` ใน devDependencies, scripts `test` / `test:watch` |
| `vitest.config.mts` | สร้างใหม่ — alias `@`, `test.include`, `environment: node` |
| `src/lib/validation.test.ts` | สร้างใหม่ — unit tests สำหรับ validation |
| `tsconfig.json` | exclude `**/*.test.ts`, `**/*.spec.ts` |
| `src/app/api/campaigns/create/route.ts` | ปรับการ log ใน catch และเมื่อ Meta AdSet/Ad/Creative ล้มเหลว |

---

## 4. ขั้นตอนถัดไป (แนะนำ)

- รัน `npm install` แล้ว `npm run test` บนเครื่องคุณเพื่อยืนยันเทสผ่าน
- ขยายเทสไปยัง `optimizer` rules หรือ helpers อื่นเมื่อมีการแยก pure functions ชัดเจน
- พิจารณา integration tests สำหรับ `POST /api/campaigns/create` (mock Meta, DB)
