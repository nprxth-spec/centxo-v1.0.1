# คู่มือยื่น Meta App Review สำหรับ Centxo

## ทำไมตอนนี้เชื่อมต่อได้แค่บัญชี Developer?

แอป Centxo อยู่ใน **โหมด Development** (การพัฒนา) ซึ่ง Meta กำหนดให้:
- ใช้ได้เฉพาะ **ผู้ที่มีบทบาทในแอป** เท่านั้น (Admin, Developer, Tester)
- ผู้ใช้ทั่วไป **ยังเชื่อมต่อ Facebook ไม่ได้**

เพื่อให้ **ผู้คนทั่วไป** เชื่อมต่อได้ ต้อง:
1. **ยื่น App Review** สำหรับ permissions ที่ใช้
2. **สลับแอปเป็นโหมด Live** หลังผ่านการตรวจสอบ

---

## สิ่งที่ต้องยืนยัน/เตรียมก่อนยื่น

| # | รายการ | รายละเอียด |
|---|--------|------------|
| 1 | **Privacy Policy** | URL นโยบายความเป็นส่วนตัว (ต้องมี) |
| 2 | **Terms of Service** | URL ข้อกำหนดการใช้งาน (แนะนำ) |
| 3 | **App Domains** | โดเมนที่ใช้ (เช่น centxo.ai, localhost สำหรับทดสอบ) |
| 4 | **OAuth Redirect URIs** | URL callback หลัง login (เช่น https://centxo.ai/api/auth/callback/facebook) |
| 5 | **Business Verification** | บาง permission อาจต้องยืนยันธุรกิจ (เช่น ads_management) |
| 6 | **การใช้งานที่อนุญาต** | กรอกครบทุก permission ที่ใช้ |

### วิธีตั้งค่าใน Meta Developer Console

| รายการ | ไปที่ |
|--------|-------|
| Privacy Policy URL | **App Settings** → **Basic** → Privacy Policy URL |
| Terms of Service | **App Settings** → **Basic** → Terms of Service URL |
| App Domains | **App Settings** → **Basic** → App Domains |
| OAuth Redirect URIs | **Facebook Login** → **Settings** → Valid OAuth Redirect URIs |

---

## ลำดับการยื่น (ต้องทำตามลำดับ)

Meta กำหนดให้ยื่นตามลำดับ dependency ดังนี้:

```
1. pages_show_list        ← ยื่นก่อน (ฐาน)
2. pages_read_engagement  ← ต้องยื่น pages_show_list ก่อน
3. ads_management         ← ต้องยื่น pages_read_engagement ก่อน
```

---

## ขั้นตอนสำหรับแต่ละ Permission

### สำหรับแต่ละ permission (pages_show_list, pages_read_engagement, ads_management) ต้องทำครบ 4 ข้อ:

| # | งาน | สถานะ |
|---|-----|-------|
| 1 | **ตรวจสอบนโยบาย** – อ่านนโยบายของ permission นั้น และบอกวัตถุประสงค์ในการใช้งาน | ⬜ |
| 2 | **อธิบายการใช้งาน** – อธิบายวิธีที่แอพจะใช้สิทธิ์นี้ | ⬜ |
| 3 | **อัพโหลด Screenshots** – แสดงประสบการณ์ผู้ใช้ตั้งแต่ต้นจนจบ (user flow) | ⬜ |
| 4 | **ตกลงปฏิบัติตาม** – ยืนยันว่าจะปฏิบัติตามการใช้งานที่ได้รับอนุญาต | ⬜ |

---

## 1. pages_show_list

**ใช้ทำอะไรใน Centxo:** แสดงรายการ Facebook Pages ที่ผู้ใช้เป็นเจ้าของหรือมีสิทธิ์ เพื่อให้เลือก Page สำหรับโฆษณา

### คำอธิบายที่แนะนำ (Describe how your app uses this permission)

```
Centxo เป็นแพลตฟอร์มจัดการโฆษณา Facebook/Meta Ads 
เราใช้ pages_show_list เพื่อ:
- แสดงรายการ Facebook Pages ที่ผู้ใช้เชื่อมต่อหรือมีสิทธิ์
- ให้ผู้ใช้เลือก Page สำหรับสร้างโฆษณา Message Ads
- แสดงในหน้า Settings → Connections และ Ads Manager → Accounts
```

### Screenshots ที่ควรอัพโหลด

1. หน้าเชื่อมต่อ Facebook (OAuth flow)
2. หน้าแสดงรายการ Pages หลังเชื่อมต่อ (เช่น /ads-manager/accounts-vcid?tab=pages-by-business)
3. หน้าสร้างแคมเปญที่ให้เลือก Page

---

## 2. pages_read_engagement

**ใช้ทำอะไรใน Centxo:** อ่านข้อมูล engagement ของ Page (เช่น insights, posts) เพื่อวิเคราะห์และสร้างโฆษณา

### คำอธิบายที่แนะนำ

```
Centxo ใช้ pages_read_engagement เพื่อ:
- ดึงข้อมูล posts และ insights ของ Facebook Page
- แสดงใน Library (ขั้นสื่อ) สำหรับเลือกวิดีโอ/โพสต์ไปใช้ในโฆษณา
- วิเคราะห์ประสิทธิภาพของ content ก่อนสร้างแคมเปญ
```

### Screenshots ที่ควรอัพโหลด

1. หน้า Library ที่แสดง posts จาก Page
2. หน้าที่แสดง insights หรือ engagement ของโพสต์
3. Flow การเลือกโพสต์ไปใช้ในแคมเปญ

---

## 3. ads_management

**ใช้ทำอะไรใน Centxo:** สร้างและจัดการโฆษณา Facebook Ads

### คำอธิบายที่แนะนำ

```
Centxo ใช้ ads_management เพื่อ:
- สร้างแคมเปญโฆษณา Message Ads บน Facebook/Meta
- จัดการ Ad Accounts, Campaigns, Ad Sets, Ads
- Pause/Resume แคมเปญตามกฎอัตโนมัติ
- ดึง insights และรายงานผลโฆษณา
```

### Screenshots ที่ควรอัพโหลด

1. หน้ารายการแคมเปญ (Campaigns list)
2. หน้าสร้างแคมเปญ (Create campaign flow)
3. หน้าเลือก Ad Account และ Page
4. หน้าการตั้งค่าแคมเปญ (budget, targeting, creative)
5. หน้าผลลัพธ์/insights หลังสร้างแคมเปญ

---

## Checklist ก่อนยื่น

- [ ] ทำครบทั้ง 4 ขั้นตอนสำหรับ **pages_show_list**
- [ ] ทำครบทั้ง 4 ขั้นตอนสำหรับ **pages_read_engagement**
- [ ] ทำครบทั้ง 4 ขั้นตอนสำหรับ **ads_management**
- [ ] App อยู่ในโหมด Development และทดสอบ flow ครบแล้ว
- [ ] Privacy Policy URL ครบถ้วน
- [ ] Terms of Service (ถ้ามี) ครบถ้วน
- [ ] App Domains และ OAuth Redirect URIs ตั้งค่าถูกต้อง

---

## วิธีเข้าหน้าจอ App Review

1. ไปที่ [Facebook Developers](https://developers.facebook.com/)
2. เลือกแอป Centxo
3. เมนูซ้าย: **App Review** → **Permissions and Features**
4. ในส่วน **การใช้งานที่อนุญาต** (Authorized Usage) กด **เริ่มต้นใช้งาน** ที่แต่ละ permission
5. กรอกข้อมูลและอัพโหลด screenshots ตามขั้นตอน
6. เมื่อครบทุก permission แล้ว จึงกด **Submit for Review**

---

## วิธีสลับเป็นโหมด Live (หลังผ่าน App Review)

1. ไปที่ [Facebook Developers](https://developers.facebook.com/)
2. เลือกแอป Centxo
3. ด้านบนขวา: กด **สลับโหมด** จาก "การพัฒนา" เป็น **"เปิดใช้งาน"** (Live)
4. หลังสลับ ผู้ใช้ทั่วไปจะเชื่อมต่อ Facebook ได้

---

## Business Verification (ยืนยันธุรกิจ)

สำหรับ permission บางตัว (เช่น **ads_management**) Meta อาจขอให้ยืนยันธุรกิจ:

1. ไปที่ **Business Settings** → **Business Info** → **Start Verification**
2. เตรียมเอกสาร: ใบรับรองบริษัท, เอกสารยืนยันที่อยู่
3. Meta จะตรวจสอบภายใน 1–2 สัปดาห์

---

## ถ้ายังไม่ได้ทำธุรกิจ ต้องยืนยันยังไง?

ตั้งแต่ปี 2023 Meta **ไม่รองรับ Individual Verification** แล้ว — ต้องมีธุรกิจที่จดทะเบียนเพื่อยืนยัน

### ทางเลือกสำหรับคนที่ยังไม่มีธุรกิจ

| ทางเลือก | รายละเอียด |
|----------|------------|
| **1. ใช้เฉพาะ Developer/Tester** | ถ้าใช้แค่ตัวเอง + คนที่เพิ่มเป็น Tester เท่านั้น → **ไม่ต้อง Business Verification** (อยู่ในโหมด Development ได้) |
| **2. จดทะเบียนพาณิชย์ (กิจการบุคคลธรรมดา)** | จดที่กรมพัฒนาธุรกิจการค้า — ใช้ชื่อตัวเองได้ ไม่ต้องตั้งบริษัท ใช้เอกสารนี้ยืนยันกับ Meta ได้ |
| **3. จดบริษัทจำกัด** | ถ้าตั้งใจทำธุรกิจจริง — ใช้ใบรับรองบริษัทยืนยันกับ Meta |
| **4. ใช้ชื่อธุรกิจเล็กๆ** | เช่น "Centxo" เป็นชื่อการค้า (DBA) ควบคู่กับกิจการบุคคลธรรมดา |

### จดทะเบียนพาณิชย์ (ทางเลือกที่เบาที่สุด)

- **ที่จด:** กรมพัฒนาธุรกิจการค้า (DBD) — [dbd.go.th](https://www.dbd.go.th)
- **ระบบที่ใช้:** เลือก **"จดทะเบียนนิติบุคคลดิจิทัล (DBD Biz Regist)"** ในเมนู จดทะเบียนธุรกิจออนไลน์
- **เอกสารที่ได้:** หนังสือรับรองการจดทะเบียนพาณิชย์
- **ใช้ยืนยันกับ Meta:** ได้ (ถือเป็นเอกสารธุรกิจ)
- **ค่าใช้จ่าย:** ประมาณ 100–200 บาท

### เอกสารที่ Meta มักขอสำหรับ Business Verification

- หนังสือรับรองการจดทะเบียน / ใบรับรองบริษัท
- เอกสารยืนยันที่อยู่ (เช่น คู่มือโทรศัพท์, ใบแจ้งหนี้สาธารณูปโภค)
- เบอร์โทรศัพท์ธุรกิจ (รับรหัส OTP ได้)
- เว็บไซต์หรือโดเมนของธุรกิจ (สำหรับยืนยันโดเมน)

### สรุป

- **ยังไม่อยากจดธุรกิจ:** ใช้แอปเฉพาะตัวเอง + Tester → อยู่ในโหมด Development ได้ ไม่ต้องยืนยันธุรกิจ
- **อยากให้คนทั่วไปใช้ได้:** ต้องจดธุรกิจ (อย่างน้อยกิจการบุคคลธรรมดา) แล้วยื่น Business Verification

---

## หมายเหตุ

- **Development mode:** สามารถใช้ได้กับ Developer/Tester เท่านั้น (ไม่ต้องผ่าน App Review)
- **Live mode:** ต้องผ่าน App Review ก่อน จึงจะให้ผู้ใช้ทั่วไปใช้งานได้
- Meta อาจใช้เวลา 1–2 สัปดาห์ในการตรวจสอบ
- ถ้าถูกปฏิเสธ Meta จะส่งเหตุผลมา ให้แก้ไขตาม feedback แล้วยื่นใหม่

---

## ลิงก์อ้างอิง

- [Meta App Review](https://developers.facebook.com/docs/app-review/)
- [Marketing API Permissions](https://developers.facebook.com/docs/marketing-api/reference/ads-management/)
- [Pages API](https://developers.facebook.com/docs/pages-api/)
