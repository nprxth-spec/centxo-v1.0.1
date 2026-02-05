# การ Scale: 200+ Users × 100 บัญชี × 1000 แคมเปญ

เอกสารนี้อธิบายพฤติกรรมของระบบเมื่อ:
- **ผู้ใช้ 200+ คน**
- **แต่ละคนมี 100+ บัญชีโฆษณา**
- **แต่ละบัญชีมี 1000+ แคมเปญ**

---

## 1. สถานการณ์ปัจจุบัน

### 1.1 Limit ที่มีอยู่

| รายการ | ค่าปัจจุบัน |
|--------|-------------|
| Plan limit (selected accounts) | **999** (ไม่จำกัดในทางปฏิบัติ) |
| API campaigns/ads/adsets | ไม่จำกัดจำนวน account ใน query |
| Dashboard stats | ไม่จำกัดจำนวน account |
| Rate limit ต่อ user | 100 req/min (standard) |
| Meta campaigns first page | 200 รายการต่อบัญชี |

### 1.2 การทำงานเมื่อ User เลือก 100 บัญชี

#### Campaigns API (`/api/campaigns`)

| ขั้นตอน | การทำงาน | Meta Calls |
|---------|----------|------------|
| Chunking | 10 บัญชี/ชุด, 100ms หน่วงระหว่างชุด | - |
| Token lookup | `getValidTokenForAdAccount` ต่อบัญชี (Redis cache) | Cache miss = 1 call/บัญชี |
| ต่อบัญชี (full mode) | account (currency) + campaigns (พร้อม insights) | **2 calls/บัญชี** |
| ต่อบัญชี (lite mode) | campaigns เท่านั้น | **1 call/บัญชี** |

**สรุป cold fetch 100 บัญชี:**
- Token: 0–100 calls (ขึ้นกับ cache)
- Data: 100 × 2 = **200 Meta calls**
- **รวมสูงสุด ~300 calls ต่อ request**
- เวลา: 10 ชุด × (~2–3 วินาที + 100ms) ≈ **25–35 วินาที**

#### Dashboard Stats (`/api/dashboard/stats`)

| ขั้นตอน | การทำงาน | Meta Calls |
|---------|----------|------------|
| Parallelism | **Promise.all ทั้งหมด** — ไม่มี chunking | - |
| ต่อบัญชี | insights + campaigns (status) | **2 calls/บัญชี** |

**สรุป 100 บัญชี:**
- **200 Meta calls ในครั้งเดียว** (burst)
- เสี่ยง rate limit สูง โดยเฉพาะ Ads Insights (app-level)

#### Ads / Ad Sets API

- โครงสร้างเหมือน campaigns: CHUNK_SIZE=10, 100ms delay
- Ads มีการดึง Page names แยก (ใช้ batch ids) — ยังโอเค

---

## 2. ปัญหาที่อาจเกิดขึ้น

### 2.1 Meta API

| ปัญหา | ผลกระทบ |
|-------|----------|
| **Ads Insights (app-level)** | 200 users × หลายบัญชี = โควต้ารวมหมดเร็ว |
| **Burst 200 calls** | Dashboard stats ไม่ chunk → ระเบิด calls พร้อมกัน |
| **Development tier** | 60 points/ad account, block 300 วินาที — 100 บัญชีแทบใช้ไม่ได้ |

### 2.2 Performance

| ปัญหา | ผลกระทบ |
|-------|----------|
| เวลาโหลดนาน | 25–35 วินาที สำหรับ campaigns (100 บัญชี) |
| Payload ใหญ่ | 100×200 = 20,000 campaigns ในหน่วยความจำ (first-page รวม) |
| Cache key ยาว | `act_xxx,act_yyy,...` (100 IDs) ≈ 4,000+ ตัวอักษร |
| Token lookup | 100 ครั้ง (ส่วนใหญ่ cache hit) แต่ Redis round-trips ยังมี |

### 2.3 ประสบการณ์ผู้ใช้

- หน้า campaigns โหลดช้ามากเมื่อเลือก 100 บัญชี
- Dashboard อาจ timeout หรือได้ 429
- การ refresh หลายคนพร้อมกันทำให้โควต้า Meta หมดเร็ว

---

## 3. ข้อเสนอการปรับปรุง

### 3.1 บังคับใช้หรือแนะนำ Cap บัญชี

**แนวทาง A: Hard cap**
- จำกัดจำนวนบัญชีที่ส่งใน query สูงสุด 20–30
- ถ้าเลือกมากกว่า แสดง "Please select up to 30 accounts" และไม่ให้โหลด

**แนวทาง B: Soft cap + warning**
- อนุญาตสูงสุด 50 บัญชี
- เกิน 20 แสดง warning: "Loading many accounts may be slow. Consider selecting fewer."

**แนวทาง C: ใช้ Plan limit จริง**
- เปิด `getPlanLimit` ตาม plan (เช่น FREE=10, PLUS=20, PRO=50)
- ลดโอกาสที่ user เลือก 100 บัญชีโดยไม่รู้ตัว

### 3.2 Dashboard Stats — เพิ่ม Chunking

```ts
// จาก: Promise.all(adAccountIds.map(...))
// เป็น: แบ่ง chunk ละ 10 บัญชี + delay 150ms ระหว่าง chunk
const CHUNK_SIZE = 10;
for (let i = 0; i < adAccountIds.length; i += CHUNK_SIZE) {
  const chunk = adAccountIds.slice(i, i + CHUNK_SIZE);
  await Promise.all(chunk.map(fetchStatsForAccount));
  if (i + CHUNK_SIZE < adAccountIds.length) {
    await new Promise(r => setTimeout(r, MetaQuotaDelays.CHUNK_DELAY_MS));
  }
}
```

### 3.3 ปรับ CHUNK_SIZE และ Delay ตามจำนวนบัญชี

```ts
// ถ้า adAccountIds.length > 50 → ใช้ CHUNK_SIZE = 5, delay = 200ms
// ถ้า > 20 → ใช้ CHUNK_SIZE = 8, delay = 150ms
const effectiveChunk = adAccountIds.length > 50 ? 5 : adAccountIds.length > 20 ? 8 : 10;
const effectiveDelay = adAccountIds.length > 50 ? 200 : adAccountIds.length > 20 ? 150 : 100;
```

### 3.4 Lite Mode อัตโนมัติสำหรับบัญชีจำนวนมาก

- ถ้า `adAccountIds.length > 30` → ใช้ `mode=lite` โดยอัตโนมัติ ( campaigns API )
- Lite = ไม่ดึง insights, fields น้อย ลดจาก 2 calls เหลือ 1 call ต่อบัญชี

### 3.5 Per-Account Cache (ทางเลือกขั้นสูง)

- Cache แยกต่อบัญชี แทน cache ตามชุด account ทั้งหมด
- Key: `meta:campaigns:v3:{userId}:{adAccountId}:{dateRange}`
- รวมผลจาก cache หลาย key
- ข้อดี: key สั้น, reuse ได้เมื่อเปลี่ยนชุดบัญชี
- ข้อเสีย: logic ซับซ้อนขึ้น, ต้อง aggregate ฝั่ง server

### 3.6 Timeout และ Error Handling

- ตั้ง request timeout สำหรับ Meta API (เช่น 30 วินาที)
- ถ้า timeout/429: return partial data + `errors: ["Some accounts could not be loaded"]`

### 3.7 UI/UX

- แสดง progress: "Loading 45/100 accounts..."
- ปุ่ม "Load first 30 accounts only" เมื่อเลือกมาก
- จำกัด choice ใน dropdown: "Select up to 30 accounts"

---

## 4. สิ่งที่ทำแล้ว (Implementation)

| รายการ | สถานะ |
|--------|--------|
| Dashboard stats: chunking + dynamic CHUNK_SIZE/delay | ✅ |
| Plan-based cap: ad accounts, pages, team members | ✅ |
| API cap ตาม plan (campaigns, adsets, ads, dashboard) | ✅ |
| Auto lite mode เมื่อบัญชี > threshold (ตาม plan) | ✅ |
| Dynamic chunking ใน campaigns, adsets, ads | ✅ |
| หน้า Pricing แสดง limits ครบ (accounts, pages, team) | ✅ |
| Team add-member ตรวจ limit ก่อนเพิ่ม | ✅ |

### ไฟล์ที่เกี่ยวข้อง

- `src/lib/plan-limits.ts` — ค่า limits ต่อ plan
- `src/app/api/dashboard/stats/route.ts` — chunking + cap
- `src/app/api/campaigns/route.ts` — cap, lite mode, dynamic chunking
- `src/app/api/adsets/route.ts` — cap, dynamic chunking
- `src/app/api/ads/route.ts` — cap, dynamic chunking
- `src/app/api/team/add-member/route.ts` — team member limit
- `src/app/api/team/add-email-member/route.ts` — team member limit
- `src/contexts/AdAccountContext.tsx` — plan limits ใน context
- `src/app/(app)/pricing/page.tsx` — แสดง limits ครบ

---

## 5. สรุป

- **ตอนนี้:** มี chunking, cap ตาม plan, auto lite mode, dynamic chunking
- **Plan limits:** FREE (10 acc, 5 pages, 0 team) | PLUS (20, 15, 3) | PRO (50, 30, 10)
