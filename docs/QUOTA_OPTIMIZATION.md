# Meta API Quota Optimization

## สรุปการใช้งาน Quota (จากภาพ)

- **เหลือ 67%** = ใช้ไป 33%
- **gr:get:Page** – 155 calls (มากที่สุด)
- **gr:get:User/accounts** – 16 calls
- **gr:get:User** – 7 calls
- **gr:get:InvalidID** – 3 calls

---

## การแก้ไขที่ทำแล้ว

### 1. Batch Page API calls ใน `/api/ads`

**เดิม:** เรียก `/{pageId}?fields=name,username` แยกทีละ Page → **N calls** (N = จำนวน unique pages)

**ใหม่:** ใช้ Meta `ids` parameter → `/?ids=id1,id2,...,id50&fields=name,username` → **1 call ต่อ ~50 pages**

**ผลลัพธ์:** ลด gr:get:Page จาก ~155 calls เหลือ ~3–4 calls (ถ้ามี 1 ad account)

---

## แนะนำเพิ่มเติม

### 1. ตั้งค่า Redis (Upstash)

เพิ่มใน `.env.local`:
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

- campaigns, adsets, ads ใช้ Redis cache → ลดการเรียก Meta API ซ้ำ
- Page names cache ใช้ Redis → ลด gr:get:Page อีก

### 2. เพิ่ม TTL ของ Page cache

ใน `src/lib/cache/redis.ts`:
- `PAGE_NAMES: 3600` (1 ชม.) – ชื่อ Page ไม่ค่อยเปลี่ยน

### 3. ลดการ Refresh บ่อย

- ปุ่ม Refresh มี cooldown 5 นาที
- Polling ทุก 15 วินาที – พิจารณาเพิ่มเป็น 30–60 วินาที ถ้าโควต้าใกล้หมด

### 4. team/config cache

- `/api/team/config` ใช้ in-memory 30 นาที
- ถ้าใช้ Redis จะ persist ได้ดีกว่า

### 5. ตรวจสอบ gr:get:InvalidID

- 3 calls อาจมาจากการเรียก ID ที่ไม่มีอยู่
- ควรเช็คก่อนเรียก API (เช่น validate ID format)

---

## สรุปผลหลังแก้ไข

| Endpoint | เดิม | หลัง Batch |
|----------|------|------------|
| gr:get:Page | ~155 calls | ~3–4 calls |
| รวม | ~181 calls | ~30 calls |

**ประมาณการ:** ลดการใช้ quota ได้ราว 80%+ สำหรับ Page calls
