# Meta API Rate Limit Optimization

## ปัญหา
แอป centxo ใช้โควต้า Meta API หมดเร็วมาก แม้ใช้แค่ 1 user - เมื่อ scale เป็น 100 users จะไม่รอด

## Endpoints ที่ใช้โควต้ามากที่สุด (จาก Meta Dashboard)
- `gr:get:User` - 525 calls (profile, picture)
- `gr:get:User/businesses` - 160 calls
- `gr:get:User/accounts` - 127 calls
- `gr:get:Page` - 106 calls
- `gr:get:InvalidID` - 57 calls

## การปรับปรุงที่ทำไป

### 1. รวม API Calls (ลด ~50% Meta calls)
- **ก่อน**: AdAccountContext เรียก 3 APIs แยกกัน → `/api/team/ad-accounts`, `/api/team/pages`, `/api/team/businesses`
  - แต่ละ API เรียก Meta 2-3 ครั้งต่อ member = **6+ Meta calls ต่อ member**
- **หลัง**: ใช้ `/api/team/config` เดียว → **3 Meta calls ต่อ member**
  - me/businesses (รวม owned_pages, client_pages)
  - me/adaccounts
  - me/accounts

### 2. เพิ่ม Cache TTL
| API | ก่อน | หลัง |
|-----|------|------|
| team/config | 10 min | **30 min** |
| team/ad-accounts | 10 min | **30 min** |
| team/pages | 10 min | **30 min** |
| team/businesses | 10 min | **30 min** |
| facebook-profile | ไม่มี | **30 min** |
| facebook-pictures | ไม่มี | **30 min** |
| Client (localStorage) | 5 min | **15 min** |

### 3. Cache สำหรับ User/Profile APIs
- **facebook-profile**: เพิ่ม cache 30 นาที (gr:get:User)
- **facebook-pictures**: เพิ่ม cache 30 นาที (gr:get:User ต่อ member)
- รองรับ `?refresh=true` เมื่อต้องการข้อมูลล่าสุด (หลัง connect Facebook)

### 4. ลด Redundant Fetches
- ลบ `refreshData()` ออกจาก AdAccountsSettings mount (ไม่ fetch ซ้ำเมื่อเปิด tab)
- ใช้ consolidated config API แทน 3 APIs แยก

### 5. Force Refresh หลัง OAuth
- เมื่อ connect Facebook สำเร็จ (`success=true`) → เรียก `fetchConnectionsData(true)` เพื่อ bypass cache

## ผลลัพธ์โดยประมาณ
- **Connections/Ad Accounts**: ลดจาก 6+ Meta calls → 3 Meta calls ต่อโหลด
- **Connections tab**: facebook-profile + facebook-pictures cache 30 นาที
- **Cache hit**: ไม่เรียก Meta API เลย

### 6. Google Sheets Export – ลดโควต้า Meta + เร่งความเร็ว
- **Conditional Insights**: ดึง insights API เฉพาะเมื่อ column mapping มี insight fields (reach, spend, impressions, clicks, etc.) เท่านั้น
- **Parallel per account**: getItems + getInsights รันพร้อมกัน (Promise.all) – ลดเวลารอ ~50% ต่อบัญชี
- **Batch accounts**: ประมวลผล 2 บัญชีพร้อมกัน + delay 150ms ระหว่าง batch – เร็วขึ้น ~2x สำหรับหลายบัญชี
- ผล: Export เร็วขึ้น ~2–3x โดยยังคงปลอดภัยจาก Meta rate limit

## คำแนะนำเพิ่มเติม
1. **gr:get:InvalidID (57 calls)** - ควรตรวจสอบว่ามีการ request ID ที่ไม่ valid หรือไม่
2. **Development mode** - Meta limit ~200 calls/user/hour; พิจารณา upgrade เป็น Live mode เมื่อพร้อม
3. **Batch API** - Meta รองรับ batch requests (หลาย operations ใน 1 call) - พิจารณาใช้สำหรับ operations ที่ทำซ้ำ
