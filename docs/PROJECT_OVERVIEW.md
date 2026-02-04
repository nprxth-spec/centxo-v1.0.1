# AdPilot AI (centxoAi) — สรุปโปรเจคสำหรับการพัฒนาต่อ

เอกสารนี้สรุปโครงสร้างและฟีเจอร์หลักของโปรเจค เพื่อใช้เป็นฐานในการพัฒนาต่อ

---

## 1. ภาพรวมโปรเจค

- **ชื่อ:** AdPilot AI (centxoAi)
- **วัตถุประสงค์:** แพลตฟอร์มจัดการ Facebook/Meta Ads แบบ AI ช่วยสร้างแคมเปญ Message Ads อัตโนมัติ โฟกัสตลาดไทย
- **สไตล์ (Blueprint):** สีหลัก #29ABE2, พื้น #F5F5F5, Accent #90EE90, ฟอนต์ Inter, การ์ดแบบ clean, มี animation เล็กน้อย

---

## 2. Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | **Next.js 15** (App Router, Turbopack) |
| Auth | **NextAuth** (Credentials, Google, Facebook) |
| DB | **MySQL** + **Prisma** |
| AI | **Genkit** + **Google Gemini** (`gemini-2.0-flash-exp`) |
| UI | **Radix UI**, **Tailwind**, **shadcn/ui**, **Framer Motion** |
| การชำระเงิน | **Stripe** (subscription) |
| Cache | **Redis** (ioredis / Upstash) |
| Storage | **AWS S3 / R2** (วิดีโอ, รูป) |
| อื่นๆ | **fluent-ffmpeg**, **sharp**, **jspdf**, **recharts**, **next-intl** |

---

## 3. โครงสร้างโฟลเดอร์หลัก

```
src/
├── ai/                    # Genkit AI
│   ├── genkit.ts          # Config + Google AI plugin
│   ├── dev.ts             # Genkit dev entry
│   └── flows/
│       ├── generate-ad-copies.ts      # สร้าง ad copy หลายชุด (TH/EN)
│       ├── analyze-media-for-ad.ts    # วิเคราะห์ media → copy + targeting + ice breakers
│       └── automated-ad-optimization.ts # กติกา + LLM แนะนำ pause/winner
├── app/
│   ├── (app)/             # Routes หลัง login
│   │   ├── dashboard/     # Dashboard KPI, charts, campaigns
│   │   ├── create-ads/    # Create Ads (Auto) — ระบบสร้างแอดออโต้
│   │   ├── reports/       # Report Studio (Pro) — สร้างรายงาน PDF ส่งลูกค้า
│   │   ├── ads-manager/   # Campaigns, Ads, Accounts, Super Target
│   │   ├── export-tools/  # Google Sheets export
│   │   ├── pricing/       # Stripe pricing
│   │   └── settings/      # Account, Meta, Billing, Team, etc.
│   ├── (landing)/         # หน้า Landing, Privacy, Terms
│   ├── admin/             # Super Admin (users, logs, interests)
│   ├── api/               # API Routes (ดูรายละเอียดด้านล่าง)
│   ├── login/, signup/
│   └── providers/
├── components/            # UI + settings + launch-wizard, ad-account-selector, etc.
├── contexts/              # AdAccountContext, LanguageContext, ThemeColorContext
├── hooks/                 # use-mobile, use-toast
├── lib/
│   ├── actions.ts         # Server actions (รวม launchCampaign แบบ mock)
│   ├── auth.ts            # NextAuth config
│   ├── audit.ts           # Audit logs
│   ├── cache/redis.ts     # Redis cache
│   ├── facebook/          # token-helper
│   ├── facebook.ts
│   ├── services/
│   │   ├── metaClient.ts   # Meta Marketing API client
│   │   ├── aiCopyService.ts
│   │   ├── optimizer.ts    # Campaign optimizer (rules + AI)
│   │   └── targetingService.ts
│   ├── video-storage.ts   # อัปโหลดวิดีโอ (local/S3/R2)
│   ├── thumbnail-generator.ts
│   ├── stripe.ts
│   └── ...
├── middleware.ts          # Protect /dashboard, /admin, etc.
└── types/
```

---

## 4. Database (Prisma)

- **User**: email, password, role (USER/ADMIN/SUPER_ADMIN), plan (FREE/PLUS/PRO), Stripe fields
- **Session, Account**: NextAuth
- **MetaAccount**: เชื่อม User กับ Meta; เก็บ access token, ad account, page
- **Campaign → AdSet → Ad → AdCreative**: โครงสร้างแคมเปญ Meta
- **AIAnalysisLog**: media hash → ผลวิเคราะห์ (รองรับ cache)
- **CampaignInsight, AdInsight, AdSetInsight**: metrics (spend, messages, costPerMessage)
- **DecisionLog, AuditLog**: การตัดสินใจของ optimizer + audit การใช้งาน
- **FacebookInterest**: interests สำหรับ targeting
- **ExportConfig**: Google Sheets export (manual + auto)
- **TeamMember**: ทีม (Facebook/email), role HOST/MEMBER/VIEWER

---

## 5. ฟีเจอร์หลัก

### 5.1 การเชื่อมต่อ Meta

- OAuth: `/api/meta/connect` → callback → เลือก Ad Account + Page → บันทึกใน `MetaAccount`
- Token เก็บแบบ encrypt (ENCRYPTION_KEY)
- ใช้ได้ทั้ง User หลักและ Team members (Facebook-based)

### 5.2 Create Ads (Auto) — ระบบสร้างแอดออโต้

- **หน้า:** `/create-ads`
- **ขั้นตอน:** บัญชีและเพจ → สื่อโฆษณา → Strategy & Budget → ข้อความโฆษณา & แชท → Review & Launch
- สื่อ: อัปโหลด video/image หรือเลือกจากไลบรารี (Facebook), คำทักทาย + ice breakers (Chat tool)
- **API จริง:** `POST /api/campaigns/create` (FormData)
  - ใช้ **analyze-media-for-ad** สำหรับ copy, targeting, ice breakers, greeting
  - สร้าง Campaign → AdSet(s) → Ad(s) บน Meta; รองรับ beneficiary (DSA)

### 5.3 AI Flows (Genkit)

| Flow | ไฟล์ | หน้าที่ |
|------|------|--------|
| **generate-ad-copies** | `generate-ad-copies.ts` | สร้างหลายชุด ad copy (TH/EN) จาก video description + numberOfAds |
| **analyze-media-for-ad** | `analyze-media-for-ad.ts` | วิเคราะห์ media (image/video) → primaryText, headline, CTA, interests, interestGroups, adCopyVariations, iceBreakers, ฯลฯ รองรับ productContext, multi-frame |
| **automate-ad-optimization** | `automated-ad-optimization.ts` | กติกา (pause เมื่อ spend ≥ X และ 0 messages, cost/message > median×multiplier; mark winner เมื่อ messages ≥ min และ cost < median) + LLM ให้คำแนะนำและ decision log |

### 5.4 Auto-Optimization

- **Cron:** `POST /api/cron/optimize` (Authorization: Bearer CRON_SECRET), `POST /api/cron/export` (auto-export ส่ง Google Sheets)
- ใช้ `optimizer.ts`: ดึง insights จาก Meta, บันทึก Campaign/AdSet/Ad insights, ใช้กติกา + `automateAdOptimization` flow
- ENV: `WARMUP_HOURS`, `MAX_SPEND_NO_MESSAGES`, `COST_PER_MESSAGE_THRESHOLD_MULTIPLIER`, `MIN_MESSAGES_FOR_WINNER`

### 5.5 Dashboard

- **หน้า:** `(app)/dashboard`
- KPIs: Spend, Revenue, ROAS, Results (messages); CPM, CTR, CPC, CPP; Funnel (View Content → Add to Cart → Purchase)
- กราฟแนวโน้ม (spend, CPR, CPM, messages)
- ตาราง Top Campaigns
- ดึงข้อมูลจาก `AdAccountContext` (เลือกได้หลาย ad accounts)

### 5.6 Report Studio (Pro)

- **หน้า:** `/reports`
- สร้างรายงานประสิทธิภาพ (KPIs + Top Campaigns) ตามช่วงวันที่และบัญชีที่เลือก
- **Export PDF** สำหรับส่งลูกค้า — ฟีเจอร์ Pro (PLUS/PRO เท่านั้น); FREE เห็น preview ได้แต่กด export ไม่ได้ มี CTA ไปอัพเกรด

### 5.6b Tools (Phase 5)

- **A/B Creative Lab** (`/tools/creative-variants`): สร้าง variant ข้อความโฆษณาหลายชุดจาก primary text / headline / context ใช้ AI
- **Auto Rules** (`/tools/auto-rules`): สร้างกฎเงื่อนไข (metric, op, value) → เมื่อตรงตามให้ **หยุดแคมเปญ** อัตโนมัติ; Run now ใช้บัญชีที่เลือก
- **Creative Fatigue Radar** (`/tools/creative-fatigue`): เทียบแอด 7 วันล่าสุด vs 7 วันก่อน แสดงสัญญาณ fatigue (CPA สูงขึ้น, CTR ลดลง ฯลฯ)

### 5.7 Ads Manager

- **Campaigns, Ads, Accounts, Super Target** ใต้ `/ads-manager`
- จัดการ campaign/ad toggle, ดู insights

### 5.8 Export (Google Sheets)

- Export config ใน settings; manual + auto export
- API: `/api/export/google-sheets`, `/api/export/google-sheets/trigger`

### 5.9 Settings

- Account, Ad Accounts, Meta Connection, Billing (Stripe), Team, Integrations, Language, Appearance, Notifications, Security, Delete Account

### 5.10 Admin (Super Admin)

- `/admin` (ต้อง role SUPER_ADMIN)
- จัดการ users, logs, interests sync

---

## 6. API Routes สำคัญ

| Route | วิธี | หน้าที่ |
|-------|------|--------|
| `/api/auth/[...nextauth]` | * | NextAuth |
| `/api/meta/connect`, `callback`, `select` | GET/POST | Meta OAuth + เลือก ad account/page |
| `/api/facebook/ad-accounts`, `pages`, `beneficiaries`, `posts`, ... | GET | ข้อมูล Meta |
| `/api/campaigns`, `campaigns/[id]`, `campaigns/create` | GET/POST/PATCH | Campaign CRUD + สร้างแคมเปญจริง |
| `/api/campaigns/create-multi` | POST | สร้างหลายแคมเปญ |
| `/api/ads/[id]`, `ads/[id]/toggle` | GET/PATCH | Ad management |
| `/api/adsets/[id]/toggle` | PATCH | AdSet toggle |
| `/api/ai/analyze-media` | POST | เรียก AI วิเคราะห์ media (copy, targeting, ice breakers) |
| `/api/ai/generate-variants` | POST | สร้าง A/B copy variants (primary text, headline) |
| `/api/automation/rules` | GET/POST | list / สร้าง automation rules |
| `/api/automation/rules/[id]` | GET/PATCH/DELETE | ดึง / แก้ / ลบ rule |
| `/api/automation/rules/run` | POST | รัน rules บนบัญชีที่ส่ง (หยุดแคมเปญที่ตรงเงื่อนไข) |
| `/api/cron/optimize` | GET/POST | สถานะ + รัน optimization |
| `/api/cron/export` | GET/POST | รัน auto-export สำหรับ config ที่เปิดไว้ |
| `/api/dashboard/stats` | GET | สถิติ dashboard |
| `/api/uploads/[...path]` | GET | serve ไฟล์อัปโหลด |
| `/api/targeting/search`, `super-target` | GET/POST | ค้นหา interests, super target |
| `/api/export/google-sheets/*` | * | Export to Sheets |
| `/api/stripe/checkout`, `webhook` | POST | Stripe checkout + webhook |
| `/api/team/*` | * | Team members, ad accounts, pages |
| `/api/r2/[...key]` | GET | R2 asset proxy |

---

## 7. Authentication & Authorization

- **NextAuth:** Credentials, Google, Facebook
- **Admin:** เข้าผ่าน Credentials โดย `loginType: 'admin'` กับ env `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`; ต้องมี role SUPER_ADMIN
- **Middleware:**  
  - `/admin/*` → login + SUPER_ADMIN เท่านั้น  
  - `/dashboard`, `/settings`, `/create-ads`, `/ads-manager` → ต้อง login

---

## 8. Environment Variables (สรุป)

- **NextAuth:** `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- **Database:** `DATABASE_URL` (MySQL)
- **Meta:** `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`
- **Google OAuth:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **AI:** `GOOGLE_API_KEY` (หรือ `GOOGLE_GENAI_API_KEY` สำหรับ analyze-media)
- **Security:** `ENCRYPTION_KEY` (≥32 chars), `CRON_SECRET`
- **Optional:** Redis, Stripe, R2/S3, Graph API version ฯลฯ

ดูรายละเอียดใน `env.production.example`, `QUICK_START.md`

---

## 9. การรันโปรเจค

```bash
npm install
npm run prisma:generate
npm run prisma:push        # หรือ migrate ตาม workflow
npm run dev                # Next dev :3000 (default)
npm run genkit:dev         # Genkit AI dev
```

Production:

```bash
npm run build
npm start                  # ใช้ server.js (custom server สำหรับ Plesk)
```

---

## 10. จุดที่ใช้พัฒนาต่อได้

### ดำเนินการแล้ว

- **Dashboard**
  - ผูกตาราง Top Campaigns กับ API จริง: ใช้ `mode=full` + `dateFrom`/`dateTo` + `limit=10` ผลลัพธ์แสดง Results, Cost/Result, Spend, ROAS (เมื่อมี revenue)
  - ปุ่ม "New Campaign" ลิงก์ไป `/create-ads`
- **Campaigns API**
  - รองรับ query `limit` แล้ว (slice ผลลัพธ์ก่อน return)
- **Launch flow**
  - หน้า Launch Wizard V3 มีแบนเนอร์แนะนำไปที่ "ระบบสร้างแอดออโต้" (`/create-ads`)
  - `launchCampaign` (actions) ไม่รัน mock อีก → return `redirectTo: '/create-ads'`; LaunchWizard redirect ไป create-ads เมื่อกด Launch
- **Create-ads**
  - Retry 1 ครั้งเมื่อ 5xx หรือ network error
  - แปลง error message เป็นข้อความที่ผู้ใช้เข้าใจง่าย (token, beneficiary, permission ฯลฯ)
- **Meta API**
  - `metaClient` retry 1 ครั้งเมื่อ 5xx หรือ 429 (rate limit)
- **Export**
  - `POST /api/cron/export` รัน auto-export ให้ทุก config ที่ `autoExportEnabled`; เรียกด้วย `Authorization: Bearer CRON_SECRET`
  - Trigger รองรับ `cronSecret` ใน body (ใช้เมื่อเรียกจาก cron)

### รอพัฒนาต่อ

1. **Launch flow**
   - ผูก `launch-wizard` / `actions.launchCampaign` ให้ใช้ `/api/campaigns/create` จริง (หรือ deprecate แล้วใช้ create-ads เป็นหลัก)
   - เพิ่ม validation และ retry ใน Meta API layer

2. **AI**
   - ปรับ prompt ใน `analyze-media-for-ad`, `generate-ad-copies` ตาม performance จริง
   - ขยาย `automate-ad-optimization` (กติกาเพิ่ม, โครงสร้าง output)

3. **Team & Multi-Account**
   - ให้ Ad Account / Page จาก Team members ใช้งานใน Launch และ Dashboard ได้ครบ

4. **Export & Reporting**
   - **Auto export:** เรียก `POST /api/cron/export` (Bearer CRON_SECRET) เพื่อรัน export ให้ทุก config ที่ `autoExportEnabled`; trigger รองรับ `cronSecret` ใน body
   - รองรับ data type เพิ่ม

5. **Performance & Scale**
   - Redis cache สำหรับ insights, rate limit Meta API
   - Queue (e.g. Bull) สำหรับ create campaign / optimize ถ้าโหลดสูง

6. **Security & Compliance**
   - ทบทวน token storage, audit log, และ DSA/beneficiary flow

7. **Tests**
   - Unit สำหรับ optimizer, AI flows
   - Integration สำหรับ `/api/campaigns/create`, Meta callback

---

## 11. Security & Compliance (สรุป)

- **Token storage:** Meta tokens เก็บแบบ AES-256-CBC encrypt (ENCRYPTION_KEY), ดู `lib/services/metaClient.ts`
- **Audit log:** ทุก action สำคัญ (CREATE_CAMPAIGN, PAUSE_AD, META_CONNECT, AUTO_RULES_PAUSE, ฯลฯ) บันทึกใน AuditLog พร้อม ipAddress, userAgent
- **DSA/Beneficiary:** เมื่อ target country = TH ระบบบังคับให้ระบุ beneficiary (DSA) — ใช้ default_dsa_beneficiary หรือ agencies จาก Meta API; ดู `getVerifiedBeneficiary` ใน campaigns/create

---

## 12. เอกสารอ้างอิงในโปรเจค

- `docs/QUICK_START.md` — ติดตั้ง, Meta, DB, Cron
- `docs/API_DOCUMENTATION.md` — รายละเอียด API
- `docs/blueprint.md` — ฟีเจอร์ + สไตล์
- `docs/AI_PROMPT_TEMPLATES.md` — AI prompts
- `docs/SECURITY.md` — ความปลอดภัย
- `docs/AUTH_SETUP.md`, `AUTH_QUICK_START.md` — Auth

---

*อัปเดตจาก codebase ล่าสุด — ใช้เป็นฐานสำหรับการพัฒนาต่อ*
