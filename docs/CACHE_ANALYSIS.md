# Cache Analysis - ทำไมโหลดช้าแม้ใช้แคช

## สรุปสาเหตุที่พบ

### 1. **บั๊กหลัก: บังคับ refresh ทุกครั้งที่โหลดหน้า** (แก้แล้ว)

ใน `AdAccountContext.tsx` เดิมเรียก `refreshData(true)` ทุกครั้งที่โหลดหน้า ทำให้:
- ส่ง `?refresh=true` ไปที่ `/api/team/config` ทุกครั้ง
- Server ข้าม in-memory cache ทุกครั้ง
- เรียก Meta API ใหม่ทุกครั้ง → โหลดช้ามาก

**การแก้ไข:** เปลี่ยนเป็น `refreshData(false)` เพื่อใช้แคชเมื่อยัง valid

### 2. **team/config ไม่ใช้ Redis**

`/api/team/config` ใช้แค่ **in-memory cache** (`globalThis._teamConfigCache`):
- ข้อมูลหายเมื่อ restart server
- บน serverless (Vercel/Lambda) อาจไม่ persist ข้าม invocation

### 3. **Redis (Upstash) อาจไม่ได้ตั้งค่า**

แคช campaigns/ads/adsets ใช้ Redis ผ่าน `UPSTASH_REDIS_REST_URL` และ `UPSTASH_REDIS_REST_TOKEN`  
ถ้าไม่มีใน `.env.local` → Redis จะเป็น null → **ไม่มีแคช** → เรียก Meta API ทุกครั้ง

---

## โครงสร้างแคชปัจจุบัน

| Endpoint | แคช | TTL |
|----------|-----|-----|
| `/api/team/config` | In-memory | 30 นาที |
| `/api/team/pages` | In-memory | 30 นาที |
| `/api/team/ad-accounts` | In-memory | 30 นาที |
| `/api/team/businesses` | In-memory | 30 นาที |
| `/api/campaigns` | Redis (Upstash) | 5 นาที |
| `/api/adsets` | Redis (Upstash) | 5 นาที |
| `/api/ads` | Redis (Upstash) | 5 นาที |
| Client (AdAccountContext) | localStorage | 15 นาที |

---

## ผลหลังแก้ไข

1. **โหลดครั้งแรก:** ยังต้อง fetch (ไม่มีแคช)
2. **โหลดครั้งถัดไปภายใน 15 นาที:** ใช้ localStorage + server cache → โหลดเร็ว
3. **กด Refresh:** ได้ข้อมูลใหม่ทันที

---

## ป้องกันการเรียก API ถี่เกินไป (Refresh Cooldown)

ปุ่ม Refresh มี cooldown 5 นาที:
- **กด Refresh ภายใน 5 นาที** → refresh ได้ปกติ แต่ข้อมูลมาจากแคช (ไม่เรียก Meta API)
- **กด Refresh หลัง 5 นาที** → เรียก API ใหม่
- **สร้างแคมเปญใหม่** → redirect มาพร้อม `?refresh=true` → เรียก API ใหม่ทันที
- **เปิด/ปิดแคมเปญ (toggle)** → เรียก API ใหม่ทันที (sync กับ Meta)

ใช้กับ:
- ConfigProvider (accounts, pages, businesses)
- Campaigns page (campaigns, adsets, ads)

---

## คำแนะนำเพิ่มเติม

### ถ้าต้องการให้เร็วขึ้นอีก

1. **ตั้งค่า Upstash Redis** – เพิ่มใน `.env.local`:
   ```
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=xxx
   ```
   จะช่วยให้ campaigns/ads/adsets ใช้แคชได้

2. **ใช้ Redis กับ team/config** – ถ้าต้องการให้ config persist ข้าม server restart

3. **Hydrate จาก localStorage ก่อน** – โค้ดทำอยู่แล้ว (state init จาก localStorage) ทำให้เห็นข้อมูลเก่าได้ทันที
