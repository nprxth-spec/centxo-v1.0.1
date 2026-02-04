# UX Testing Checklist — Phase 3

ใช้ checklist นี้ไล่ทดสอบ UX หลัง Phase 3 (Empty states, Skeletons, Create-ads, i18n)

**Base URL:** `http://localhost:3000`  
**ต้อง login ก่อน** (ใช้บัญชีที่เชื่อม Facebook / Ad accounts แล้ว)

---

## 0. Quick verification (ก่อนทดสอบ UX)

| สิ่งที่ตรวจ | คำสั่ง | ผล |
|------------|--------|-----|
| TypeScript | `npx tsc --noEmit` | ผ่าน โดยไม่มี error |
| Unit tests (Phase 4) | `npm run test` | หลัง `npm install` แล้วรันเทส validation |
| Build | `npm run build` | รันบนเครื่องคุณ (ต้องมี network เพื่อ Prisma) |
| Dev server | `npm run dev` | รันที่ `http://localhost:3000` |

---

## 1. Dashboard (`/dashboard`)

| # | รายการ | วิธีทดสอบ | ✅ |
|---|--------|-----------|---|
| 1.1 | **Loading skeletons** | เลือก Ad accounts ใน Settings → Connections แล้วมา Dashboard ที่มีบัญชีเลือกไว้ → โหลดครั้งแรกควรเห็น **skeleton การ์ด** (สี่เหลี่ยมเทา animate-pulse) ทั้งแถว KPI และแถว Efficiency (CPM, CTR, CPC, CPP) ก่อนจะแสดงตัวเลขจริง | |
| 1.2 | **ไม่มี skeleton ตลอด** | หลังโหลดเสร็จ skeleton หายไป แสดงตัวเลขจริง | |
| 1.3 | **ไม่มีบัญชี** | ลองเอา Ad accounts ออกทั้งหมด (Settings → Connections) แล้วกลับมา Dashboard → ไม่โหลดค้าง (loading ไม่ติด true ตลอด) | |
| 1.4 | **Error + Retry** | ถ้า API ล้มเหลว (ปิดเครือข่ายหรือ mock error) → มี **Alert สีแดง** พร้อมปุ่ม **Retry** | |
| 1.5 | **ภาษา** | สลับ TH/EN → ข้อความ KPI, Funnel, Charts เปลี่ยนตามภาษา | |

---

## 2. Ads Manager — Campaigns (`/ads-manager/campaigns`)

| # | รายการ | วิธีทดสอบ | ✅ |
|---|--------|-----------|---|
| 2.1 | **เลือกบัญชี** | เลือกอย่างน้อย 1 Ad account จาก dropdown "Select Account" (หรือ All Accounts) | |
| 2.2 | **Loading ตาราง** | ก่อนโหลด Campaigns / Ad Sets / Ads → เห็น **skeleton แถวตาราง** (แถวเทา animate-pulse) | |
| 2.3 | **Empty — Campaigns** | ถ้าไม่มีแคมเปญ → ขึ้น **ไอคอนโฟลเดอร์** ข้อความ "No campaigns yet" / "ยังไม่มีแคมเปญ" และปุ่ม **"Create Your First Campaign"** / "สร้างแคมเปญแรก" ลิงก์ไป `/create-ads` | |
| 2.4 | **Empty — Ad Sets** | เปลี่ยนไปแท็บ Ad Sets → ถ้าไม่มีชุดโฆษณา → **ไอคอน LayoutGrid** ข้อความ "No ad sets yet" / "ยังไม่มีชุดโฆษณา" และปุ่ม **"Create a campaign to get started"** / "สร้างแคมเปญเพื่อเริ่มต้น" | |
| 2.5 | **Empty — Ads** | เปลี่ยนไปแท็บ Ads → ถ้าไม่มีโฆษณา → **ไอคอน Briefcase** ข้อความ "No ads yet" / "ยังไม่มีโฆษณา" และปุ่ม CTA เดียวกัน | |
| 2.6 | **No match (มีข้อมูลแต่ filter ไม่ตรง)** | มีแคมเปญ/ชุดโฆษณา/โฆษณาอยู่ → ค้นหาหรือเลือก filter ให้ไม่ตรงกับอะไร → ขึ้น "No campaigns match your filters" etc. และ **ไม่มีปุ่ม CTA** | |
| 2.7 | **Refresh** | กดปุ่ม Refresh → มี loading (ไอคอนหมุน) แล้วโหลดใหม่ | |
| 2.8 | **ภาษา** | สลับ TH/EN → empty states, ปุ่ม Refresh/Export, dropdown "Selected" เปลี่ยนตามภาษา | |

---

## 3. Create Ads (`/create-ads`)

| # | รายการ | วิธีทดสอบ | ✅ |
|---|--------|-----------|---|
| 3.1 | **ขั้นตอนที่ 1** | เลือก Ad account และ Facebook page → ปุ่ม **Next** เปิดใช้งาน | |
| 3.2 | **Next  disabled** | ไม่เลือกบัญชี/เพจ → ปุ่ม Next **disabled** | |
| 3.3 | **Back ล้าง error** | สร้าง error (เช่น ข้าม step ไม่เลือกสื่อ แล้วไปกด Launch ผิดขั้น) → เห็น error → กด **Back** → ข้อความ error **หายไป** | |
| 3.4 | **Next ล้าง error** | มี error แล้วกด **Next** (เมื่อสามารถกดได้) → error **หายไป** | |
| 3.5 | **Launch loading** | กด Launch → ปุ่ม Launch แสดง **Loader** และ **disabled** ตอนกำลังส่ง | |
| 3.6 | **Next  disabled ตอน loading** | เมื่อกำลัง Launch (หรือ flow ที่ทำให้ loading = true) → ปุ่ม **Next** (ถ้ามี) **disabled** และมี spinner ถ้าใช้ | |
| 3.7 | **Library loading** | เปิด Library (ขั้นสื่อ) → ตอนดึงวิดีโอจาก Meta ขึ้น "Loading library…" / "กำลังโหลดไลบรารี…" | |
| 3.8 | **ภาษา** | สลับ TH/EN → ป้ายขั้นตอน, ปุ่ม Next/Back/Launch, ข้อความ error/loading เปลี่ยนตามภาษา | |

---

## 4. สรุปผ่าน/ไม่ผ่าน

- **Dashboard:** ผ่าน __ / 5  
- **Ads Manager Campaigns:** ผ่าน __ / 8  
- **Create Ads:** ผ่าน __ / 8  

**หมายเหตุ:** ถ้าเจอจุดที่ยังไม่ตรงตาม checklist หรือ UX ผิดปกติ ให้จด step + หน้าจอ (หรือข้อความ error) ไว้สำหรับแก้ต่อ
