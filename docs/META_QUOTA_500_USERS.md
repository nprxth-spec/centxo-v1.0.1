# Meta API Quota — รองรับ 500+ Users

เอกสารนี้อธิบายการจัดการโควต้า Meta API เพื่อให้ระบบรองรับผู้ใช้มากกว่า 500 คน โดยโควต้าไม่เต็ม

---

## 1. โครงสร้างโควต้า Meta

### 1.1 Marketing API (per Ad Account)

| Tier | Max Score | Decay | Block เมื่อเกิน |
|------|-----------|-------|-----------------|
| Development | 60 points | 300 วินาที | 300 วินาที |
| Standard | 9,000 points | 300 วินาที | 60 วินาที |

- **Read call = 1 point**, Write = 3 points
- โควต้าแยก **ต่อ Ad Account** — แต่ละบัญชีโฆษณามีโควต้าเป็นของตัวเอง

### 1.2 Ads Insights (App Level)

- โควต้าแชร์ทั้งแอป
- เมื่อเต็ม → ทุก user ได้รับผลกระทบ
- **วิธีลด:** cache insights นานขึ้น, ใช้ async requests สำหรับข้อมูลปริมาณมาก

### 1.3 Graph API (User, Page — ไม่ใช่ Marketing API)

- ประมาณ **200 calls × DAU ต่อชั่วโมง**
- 500 DAU ≈ 100,000 calls/hour
- ใช้สำหรับ: profile, picture, me/businesses, me/accounts

### 1.4 App Level Limit

- "Application request limit reached" เมื่อแอปเรียกเยอะเกิน
- ขึ้นกับจำนวน total users ของแอป

---

## 2. แนวทางหลักสำหรับ 500+ Users

### 2.1 Caching (ลด Meta calls มากที่สุด)

| Endpoint | TTL 200 users | TTL 500 users | หมายเหตุ |
|----------|---------------|---------------|----------|
| team/config | 2 ชม. | **3 ชม.** | accounts, pages, businesses |
| team/ad-accounts | 1 ชม. | **2 ชม.** | |
| team/facebook-pictures | 1 ชม. | **2 ชม.** | gr:get:User |
| dashboard/stats | 10 นาที | **15 นาที** | insights |
| campaigns, adsets, ads | 5 นาที | **10 นาที** | first-page paginated |
| PAGE_NAMES | 1 ชม. | **2 ชม.** | gr:get:Page |

### 2.2 Polling & Refresh

| การกระทำ | 200 users | 500 users |
|----------|-----------|-----------|
| Campaigns polling | 15 วินาที | **60 วินาที** |
| Client refresh cooldown | 15 นาที | **20 นาที** |
| Manual refresh cooldown | 5 นาที | **10 นาที** |

### 2.3 Request Throttling

- **Chunk delay:** 100ms ระหว่าง batch ของ accounts
- **Export:** Cap 10 accounts, delay 200ms ระหว่าง batch
- **429 retry:** Exponential backoff (2.5s → 5s → 10s)

### 2.4 Pagination

- Campaigns, Ad Sets, Ads: **50 แถว/หน้า**, first-page-only จาก Meta
- ลดจำนวน Meta calls ต่อ request อย่างมาก

---

## 3. การ Implement ในโปรเจกต์

### 3.1 ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|------|---------|
| `src/lib/meta-quota-config.ts` | ค่า config กลาง (TTL, polling, delays) |
| `src/lib/cache/redis.ts` | Cache TTL ใช้ค่าจาก config |
| `src/contexts/AdAccountContext.tsx` | CACHE_DURATION, REFRESH_COOLDOWN, rate limit circuit breaker |
| `src/app/(app)/ads-manager/campaigns/page.tsx` | Polling interval |
| `src/lib/services/metaClient.ts` | 429 retry with backoff |

### 3.2 Meta Quota Config

เพิ่มใน `.env` หรือ `.env.local`:
```
META_QUOTA_SCALE=500   # '200' | '500' | '1000'
```

ไม่ใส่ = ใช้ค่า default 500 (รองรับ 500+ users)

### 3.3 Rate Limit Circuit Breaker (มีอยู่แล้ว)

- เมื่อได้ error codes: 80004, 17, 32, 613 → เปิด circuit breaker 15 นาที
- หยุดเรียก Meta จนครบเวลา
- แสดง dialog แจ้งผู้ใช้

### 3.4 Upgrade Meta App Tier

- **Development** → **Standard** (Advanced Access ผ่าน App Review)
- ได้โควต้า Marketing API สูงขึ้นมาก (60 → 9,000 points ต่อ ad account)

---

## 4. Checklist สำหรับ Scale 500+ Users

- [ ] ตั้งค่า Redis (Upstash) — cache ใช้ Redis แทน in-memory
- [ ] ใช้ `META_QUOTA_SCALE=500` หรือสูงกว่า
- [ ] Upgrade Meta App เป็น Standard tier (Advanced Access) ถ้ายังเป็น Development
- [ ] ตรวจสอบ Meta App Dashboard — Usage, Rate Limiting
- [ ] ใช้ pagination ทุกที่ที่มี list ใหญ่
- [ ] ไม่เปิด polling บนทุก tab — เฉพาะ tab ที่ active
- [ ] Export: จำกัด accounts ต่อครั้ง, ใช้ conditional insights

---

## 5. การ Monitor

### 5.1 HTTP Headers จาก Meta

- `X-Ad-Account-Usage` — acc_id_util_pct, reset_time
- `X-Business-Use-Case` — call_count, estimated_time_to_regain_access
- `X-FB-Ads-Insights-Throttle` — สำหรับ Insights API

### 5.2 Error Codes

| Code | Subcode | ความหมาย |
|------|---------|----------|
| 17 | 2446079 | User request limit reached |
| 613 | 1487742 | Too many calls from this ad-account |
| 4 | 1504022/1504039 | Ads Insights app-level limit |
| 4 | - | Application request limit reached |
| 80000, 80003, 80004, 80014 | - | BUC rate limit |

### 5.3 แนะนำ

- Log 429/rate limit errors พร้อม userId, endpoint
- Alert เมื่อ error เหล่านี้เพิ่มขึ้นผิดปกติ
