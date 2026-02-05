# จุดที่ใช้โควต้า Meta API เยอะที่สุด

สรุปจากการตรวจทั้งโปรเจกต์ — เรียงตามความหนัก (มากไปน้อย)

**→ สำหรับการ scale 500+ users:** ดู [META_QUOTA_500_USERS.md](./META_QUOTA_500_USERS.md)

---

## 1. หนักมาก – ควร optimize ก่อน

### `team/ad-accounts` (GET)
| รายการ | ค่า |
|--------|-----|
| Meta calls ต่อ member | **2+ calls** (me/businesses + me/adaccounts) |
| Cache | In-memory 1 ชม. (ไม่มี Redis) |
| หมายเหตุ | ซ้ำกับ team/config เพราะดึง ad accounts อีกที |

**สถานะ:** ✅ เพิ่ม Redis cache (เหมือน team/config), invalidate เมื่อ connect Facebook

---

### `dashboard/stats` (GET)
| รายการ | ค่า |
|--------|-----|
| Meta calls ต่อ ad account | **2 calls** (insights + campaigns) |
| ถ้ามี 5 ad accounts | 10 calls |
| Cache | Redis 5 นาที |

**สถานะ:** ✅ เพิ่ม TTL เป็น 10 นาที (600 วินาที)

---

### `export/google-sheets/trigger` (POST)
| รายการ | ค่า |
|--------|-----|
| Meta calls | **หลาย calls** ต่อ ad account (adaccounts, campaigns, adsets, ads, insights) |
| Cache | ไม่มี |
| หมายเหตุ | ใช้ lib/facebook.ts — ดึงข้อมูลเยอะมากต่อ export |

**สถานะ:** ✅ Conditional insights มีอยู่แล้ว, จำกัด 10 accounts ต่อ export, delay 200ms ระหว่าง batch

---

## 2. ปานกลาง – มี cache แต่ยังน่า optimize

### `team/facebook-pictures` (GET)
| รายการ | ค่า |
|--------|-----|
| Meta calls ต่อ member | **1 call** (User?fields=name,picture) |
| ถ้ามี 5 members | 5 gr:get:User calls |
| Cache | In-memory 60 นาที (ไม่มี Redis) |

**สถานะ:** ✅ เพิ่ม Redis cache (1 ชม.), invalidate เมื่อ connect Facebook

---

### `team/config` (GET)
| รายการ | ค่า |
|--------|-----|
| Meta calls ต่อ member | **3 calls** (me/businesses, me/adaccounts, me/accounts) |
| Cache | Redis 2 ชม. + in-memory |

**สถานะ:** มีการ optimize แล้ว

---

### `campaigns/create` และ `campaigns/create-multi` (POST)
| รายการ | ค่า |
|--------|-----|
| Meta calls ต่อ campaign | มาก (adinterest search, adaccount, campaigns, adsets, adcreatives, ads, adimages, advideos) |
| Cache | ไม่มี (เป็น user-initiated action) |

**หมายเหตุ:** ใช้โควต้ามากแต่เป็น action ที่ผู้ใช้สั่งโดยตรง ลดได้โดยการ batch requests ถ้า Meta รองรับ

---

## 3. มี cache แล้ว – น่าจะโอเค

| Endpoint | Meta calls | Cache |
|----------|------------|-------|
| `campaigns` (GET) | 2+ per ad account | Redis 5 นาที (withCacheSWR) |
| `ads` (GET) | 2+ per ad account + Page names | Redis 5 นาที + Page batch |
| `adsets` (GET) | 2+ per ad account | Redis 5 นาที |
| `facebook/ad-accounts` | 1 per token | Redis 1 ชม. |
| `facebook/profile-picture` | 1 per userId | In-memory 24 ชม. |
| `connections/data` | 1 me (เมื่อมี MetaAccount) | In-memory 60 นาที |

---

## 4. อื่น ๆ – เรียกไม่บ่อย

| Endpoint | หมายเหตุ |
|----------|----------|
| `facebook/pages/[pageId]/posts` | 2 calls (feed + ads_posts) ต่อหน้า |
| `facebook/posts/[postId]/comments` | comments ต่อโพสต์ |
| `facebook/comments/[commentId]` | comment เดี่ยว |
| `facebook-adbox.ts` | me/accounts, conversations, messages — ใช้เมื่อเปิด Inbox |
| `facebook/ice-breakers` | 2 calls (GET + POST) — ใช้เมื่อตั้งค่า ice breakers |
| `ads/spending-limit` | 2–3 calls — ใช้เมื่อเปลี่ยน spending limit |
| `campaigns/[id]/toggle`, `ads/[id]/toggle`, `adsets/[id]/toggle` | 2–3 calls ต่อ toggle |

---

## สรุปลำดับการแก้ไขที่แนะนำ (ทำครบแล้ว ✅)

1. **team/ad-accounts** – ✅ Redis cache + invalidate  
2. **export/google-sheets/trigger** – ✅ Cap 10 accounts, delay 200ms  
3. **team/facebook-pictures** – ✅ Redis cache + invalidate  
4. **dashboard/stats** – ✅ TTL 10 นาที  

---

## Meta API Endpoints ที่ใช้งบโควต้ามาก (จาก docs)

- `gr:get:User` — profile, picture  
- `gr:get:User/businesses`  
- `gr:get:User/accounts`  
- `gr:get:Page`  
- `gr:get:AdAccount/insights`  
- `gr:get:AdInterest` (search)
