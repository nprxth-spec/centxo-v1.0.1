# Security Audit Report - Centxo

สรุปการตรวจสอบช่องโหว่ด้านความปลอดภัย (SQL injection, XSS, CSRF, Brute force, API leak, Directory traversal, Command injection)

---

## สรุปภาพรวม

| ช่องโหว่ | สถานะ | รายละเอียด |
|----------|-------|------------|
| **SQL Injection** | ✅ ป้องกัน | ใช้ Prisma ORM (parameterized queries) |
| **XSS** | ⚠️ เสี่ยงต่ำ | มี dangerouslySetInnerHTML แต่ใช้กับ static content |
| **CSRF** | ⚠️ บางส่วน | มี CSRF protection แต่ใช้เฉพาะบาง route |
| **Brute Force** | ✅ ป้องกัน | Rate limit มี รวมถึง Login (credentials) |
| **API Leak** | ✅ ป้องกัน | API ส่วนใหญ่ตรวจสอบ session |
| **Directory Traversal** | ✅ ป้องกัน | uploads route มี path validation + path.resolve + ตรวจ `..` |
| **Command Injection** | ✅ ป้องกัน | ไม่พบ exec/spawn ที่รับ user input |

---

## 1. SQL Injection ✅ ป้องกัน

**การตรวจสอบ:**
- ใช้ **Prisma ORM** ทั้งหมด — ไม่พบ `$queryRaw`, `$executeRaw` หรือ raw SQL
- Prisma ใช้ parameterized queries โดยอัตโนมัติ

**สถานะ:** ปลอดภัย

---

## 2. XSS (Cross-Site Scripting) ⚠️ เสี่ยงต่ำ

**การตรวจสอบ:**
- พบ `dangerouslySetInnerHTML` ใน:
  - `privacy/page.tsx` — แสดงข้อความจาก `t()` (static translations)
  - `data-deletion/page.tsx` — แสดงข้อความจาก `t()` + `.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')`
  - `chart.tsx` — ใช้กับ chart library

**ความเสี่ยง:** ต่ำ — เนื้อหามาจาก static messages (lib/messages.ts) ไม่ใช่ user input โดยตรง

**คำแนะนำ:**
- ถ้ามีการดึงข้อความจาก CMS หรือ user input ในอนาคต ควรใช้ DOMPurify หรือ sanitize ก่อน
- พิจารณาใช้ `<span>{text}</span>` แทน dangerouslySetInnerHTML ถ้าเป็นไปได้

---

## 3. CSRF (Cross-Site Request Forgery) ⚠️ บางส่วน

**การตรวจสอบ:**
- มี CSRF middleware ที่ `lib/middleware/csrf.ts` (double-submit cookie pattern)
- **ใช้แล้ว:** `campaigns/[id]` (DELETE, PATCH), `launch` (POST)
- **ยังไม่ได้ใช้:** API routes อื่นๆ ที่เป็น POST/PUT/DELETE (campaigns/create, ads, adsets, automation, export, ฯลฯ)

**ความเสี่ยง:** ปานกลาง — NextAuth ใช้ session cookies; SameSite cookie ช่วยได้บ้าง แต่ state-changing operations ควรมี CSRF

**คำแนะนำ:**
- เพิ่ม `csrfProtection()` ให้ POST/PUT/DELETE routes ที่สำคัญ (campaigns/create, export, user/update, ฯลฯ)
- หรือใช้ NextAuth CSRF token ที่มีอยู่แล้ว (NextAuth มี built-in CSRF)

---

## 4. Brute Force ⚠️ บางส่วน

**การตรวจสอบ:**
- มี **rate limiting** ที่ `lib/middleware/rateLimit.ts`
- ใช้ Redis (Upstash) หรือ in-memory fallback
- **มี rate limit:** register (5/5min), campaigns (10/5min), AI (20/5min), standard API (100/min)
- **ไม่มี rate limit:** **Login (NextAuth credentials)** — ยังไม่มี

**ความเสี่ยง:** ปานกลาง — การโจมตี brute force ต่อหน้า login ยังทำได้

**คำแนะนำ:**
- เพิ่ม rate limiting ให้ `/api/auth/[...nextauth]` สำหรับ credentials provider
- หรือใช้ middleware ตรวจ path `/api/auth/callback/credentials` แล้ว rate limit ตาม IP

---

## 5. API Leak ✅ ป้องกัน

**การตรวจสอบ:**
- API routes ส่วนใหญ่ตรวจสอบ `getServerSession()` และคืน 401 ถ้าไม่มี session
- Cron/export ใช้ `CRON_SECRET` สำหรับ authorization
- Export trigger ใช้ `cronSecret` หรือ session
- R2 route ตรวจสอบ `fileKey.includes(session.user.id)` — จำกัดให้เข้าถึงเฉพาะไฟล์ของตัวเอง

**Public APIs (โดย design):**
- `/api/health-check` — health check
- `/api/facebook/data-deletion` — Meta data deletion callback
- `/api/auth/*` — NextAuth (signin, callback, etc.)
- `/api/stripe/webhook` — Stripe webhook (ใช้ signature verification)

**สถานะ:** ปลอดภัย

---

## 6. Directory Traversal ✅ ป้องกัน

**การตรวจสอบ:**
- `uploads/[...path]/route.ts`:
  - ใช้ `path.join(process.cwd(), 'uploads', filePath)`
  - ตรวจสอบ `fullPath.startsWith(uploadsDir)` ก่อนอ่านไฟล์
  - path.join จะ normalize `..` — ถ้า path หลุดออกจาก uploads จะไม่ startWith(uploadsDir) → คืน 403

**คำแนะนำ (เสริม):**
- ใช้ `path.resolve()` เพื่อความชัดเจน:  
  `path.resolve(fullPath).startsWith(path.resolve(uploadsDir))`
- ตรวจสอบว่า path ไม่มี `..` ก่อน join:  
  `if (filePath.includes('..')) return 403`

---

## 7. Command Injection ✅ ป้องกัน

**การตรวจสอบ:**
- ไม่พบ `exec()`, `execSync()`, `spawn()`, `child_process` ที่รับ user input โดยตรง
- พบ `pipeline.exec()` ใน redis.ts — เป็น Redis pipeline ไม่ใช่ shell

**สถานะ:** ปลอดภัย

---

## สรุปคำแนะนำที่ควรทำ

| ลำดับ | รายการ | ความสำคัญ | สถานะ |
|-------|--------|------------|-------|
| 1 | เพิ่ม rate limit ให้ Login (NextAuth) | สูง | ✅ ทำแล้ว |
| 2 | ขยาย CSRF protection ให้ POST/PUT/DELETE routes ที่สำคัญ | ปานกลาง | ต้องอัปเดต frontend |
| 3 | เสริม directory traversal ใน uploads ด้วย `path.resolve` + ตรวจ `..` | ต่ำ | ✅ ทำแล้ว |
| 4 | ติดตาม XSS ถ้ามี dynamic content จาก user/CMS | ต่ำ | - |

---

## ไฟล์ที่เกี่ยวข้อง

- Rate limit: `src/lib/middleware/rateLimit.ts`
- CSRF: `src/lib/middleware/csrf.ts`
- Auth: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`
- Uploads: `src/app/api/uploads/[...path]/route.ts`
- Security doc: `docs/SECURITY.md`
