# AI Auto Messages Ads Launcher

## 📋 Project Overview

เว็บแอปพลิเคชันสำหรับสร้างและจัดการแคมเปญโฆษณา Facebook Messages แบบอัตโนมัติด้วย AI โดยผู้ใช้แค่ Upload Video เลือก Page และระบุจำนวน Ads ที่ต้องการ ระบบจะสร้าง Campaign พร้อม Ad copies หลายรูปแบบโดยใช้ AI และเริ่มรันทันที พร้อมระบบ Auto-optimization ที่จะวิเคราะห์ผลลัพธ์และปรับ Ads อัตโนมัติทุก 15 นาที

## 🚀 Tech Stack

- **Frontend**: Next.js 14+ (App Router) + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Next.js Route Handlers (API) + Prisma + MySQL
- **Authentication**: NextAuth (Credentials - username/password)
- **AI**: Google Gemini (via Genkit) - สำหรับ generate ad copies
- **Meta API**: Facebook Marketing API (Graph API v21.0)
- **Scheduler**: Cron job endpoint (เรียกจาก cron-job.org ทุก 15 นาที)

## 📁 Project Structure

```
download/
├── app/
│   ├── (app)/                    # Authenticated routes
│   │   ├── dashboard/            # Dashboard แสดงแคมเปญทั้งหมด
│   │   │   └── page.tsx
│   │   ├── launch/               # Launch wizard (4 steps)
│   │   │   └── page.tsx
│   │   ├── campaigns/
│   │   │   └── [id]/             # Campaign detail page
│   │   │       └── page.tsx
│   │   └── settings/
│   │       └── meta/             # Meta connection settings
│   │           └── page.tsx
│   ├── (auth)/                   # Auth routes (login/signup)
│   ├── api/
│   │   ├── launch/               # POST: Launch new campaign
│   │   │   └── route.ts
│   │   ├── campaigns/            # GET: List campaigns
│   │   │   ├── route.ts
│   │   │   └── [id]/             # GET/PATCH: Campaign details/update
│   │   │       └── route.ts
│   │   ├── ads/
│   │   │   └── [id]/             # PATCH: Update ad status
│   │   │       └── route.ts
│   │   ├── meta/
│   │   │   ├── connect/          # GET: Initialize Facebook OAuth
│   │   │   │   └── route.ts
│   │   │   ├── callback/         # GET: OAuth callback handler
│   │   │   │   └── route.ts
│   │   │   └── select/           # GET/POST: Ad accounts & pages
│   │   │       └── route.ts
│   │   └── cron/
│   │       └── optimize/         # POST: Auto-optimization cron
│   │           └── route.ts
│   └── globals.css
├── lib/
│   ├── services/
│   │   ├── metaClient.ts         # Meta API client & helpers
│   │   ├── aiCopyService.ts      # AI copy generation service
│   │   └── optimizer.ts          # Campaign optimization logic
│   ├── types.ts
│   ├── utils.ts
│   └── constants.ts
├── components/
│   └── ui/                       # shadcn/ui components
├── prisma/
│   └── schema.prisma             # Database schema (MySQL)
├── .env.local                    # Environment variables
├── .env.example                  # Example environment variables
├── package.json
└── README.md
```

## 🗄️ Database Schema

### Tables:
1. **User** - ผู้ใช้งานระบบ
2. **Account** - NextAuth accounts
3. **MetaAccount** - Facebook/Meta account connection
4. **Campaign** - แคมเปญโฆษณา
5. **AdSet** - Ad sets ภายใน campaign
6. **Ad** - โฆษณาแต่ละตัว
7. **AdCreative** - Ad creative (video + copy)
8. **CampaignInsight** - Metrics ของ campaign (รายวัน)
9. **AdSetInsight** - Metrics ของ ad set (รายวัน)
10. **AdInsight** - Metrics ของ ad แต่ละตัว (รายวัน)
11. **DecisionLog** - บันทึกการตัดสินใจของ optimizer
12. **AuditLog** - บันทึก actions ทั้งหมด

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - เข้าสู่ระบบ
- `POST /api/auth/register` - สมัครสมาชิก

### Meta Connection
- `GET /api/meta/connect` - เริ่มต้น Facebook OAuth
- `GET /api/meta/callback` - รับ OAuth callback
- `GET /api/meta/select?type=accounts` - ดึงรายการ ad accounts
- `GET /api/meta/select?type=pages` - ดึงรายการ pages
- `POST /api/meta/select` - บันทึก ad account และ page ที่เลือก

### Campaign Management
- `GET /api/launch` - เช็คความพร้อม (Meta connected, ad account, page)
- `POST /api/launch` - สร้างและ launch campaign ใหม่
- `GET /api/campaigns` - ดึงรายการ campaigns ทั้งหมด
- `GET /api/campaigns/[id]` - ดึงรายละเอียด campaign + ads + insights
- `PATCH /api/campaigns/[id]` - Pause/Resume/Archive campaign
- `PATCH /api/ads/[id]` - Pause/Resume ad

### Automation
- `POST /api/cron/optimize` - Optimize campaigns (เรียกจาก cron-job.org)
- `GET /api/cron/optimize` - Health check & stats

## 🔐 Security Features

### 1. Token Encryption
- Meta access tokens เข้ารหัสด้วย AES-256-CBC ก่อนเก็บใน database
- ใช้ `ENCRYPTION_KEY` จาก ENV

### 2. API Security
- Cron endpoint ต้องส่ง `Authorization: Bearer {CRON_SECRET}` header
- ทุก API route ตรวจสอบ authentication ผ่าน NextAuth session
- User สามารถเข้าถึงได้แค่ campaigns ของตัวเองเท่านั้น

### 3. Audit Logging
- บันทึกทุก action ที่ส่งไป Meta API
- บันทึก IP address และ User-Agent
- บันทึกการสร้าง/แก้ไข/หยุด campaigns และ ads

### 4. Rate Limiting
- Handle Meta API rate limits gracefully
- Retry logic with exponential backoff

### 5. Least Privilege
- Request เฉพาะ Facebook permissions ที่จำเป็น
- Scope: `ads_management`, `ads_read`, `pages_manage_ads`, `pages_show_list`

## 🤖 AI Copy Generation

### System Prompt
- Expert Facebook Ads copywriter
- เชี่ยวชาญตลาด Thailand
- Generate ทั้ง Thai และ English versions
- Focus on Messages objective

### Generated Content
- **Primary Text**: 125 chars max (ภาษาไทยและอังกฤษ)
- **Headline**: 40 chars max (optional)
- **CTA Message Prompt**: 60 chars max (ข้อความเมื่อคลิก Message)

### Variation Strategy
- Test different angles: benefits, urgency, social proof, curiosity
- Different emotional triggers
- Diverse messaging approaches

## 📊 Auto-Optimization Rules

### Warmup Period (3 hours)
- **ไม่มีการ optimize** ใน 3 ชั่วโมงแรก
- ให้ algorithm ของ Facebook เรียนรู้ก่อน

### Rule 1: Pause No-Message Ads
- **Condition**: `spend >= $5 AND messages = 0`
- **Action**: Pause ad
- **Reason**: ป้องกันการเผาเงินกับ ad ที่ไม่ได้ messages

### Rule 2: Pause High-Cost Ads
- **Condition**: `cost_per_message > median(cost_per_message) * 1.5`
- **Action**: Pause ad
- **Reason**: หยุด ads ที่ cost สูงเกินไป

### Rule 3: Mark Winners
- **Condition**: `messages >= 3 AND cost_per_message < average(cost_per_message)`
- **Action**: Mark as winner (isWinner = true)
- **Reason**: ระบุ ads ที่ perform ดี เพื่อใช้ duplicate หรือ scale

### Rule 4: Auto-Pause Campaign
- **Condition**: All ads are paused
- **Action**: Pause campaign
- **Reason**: ประหยัดค่าใช้จ่าย

### Execution
- รันทุก 15 นาที ผ่าน cron job
- Fetch insights จาก Meta API
- คำนวณ metrics และเปรียบเทียบ
- Execute actions ผ่าน Meta API
- บันทึก decision log

## 🎯 Default Campaign Settings

```javascript
{
  objective: 'MESSAGES',
  country: 'TH',  // Thailand
  dailyBudget: 20,  // USD
  minAge: 20,
  languages: ['th', 'en'],  // Thai + English
  placements: 'Advantage+ placements',  // Facebook auto-optimized
  schedule: '24/7',
  targeting: 'Broad' (no interests)
}
```

## 🎨 UI Wireframes

### 1. Login/Register Page
```
┌─────────────────────────────────┐
│   🚀 AI Auto Messages Ads       │
│                                 │
│   Email: ___________________    │
│   Password: ________________    │
│                                 │
│   [  Login  ]  [Register]       │
└─────────────────────────────────┘
```

### 2. Dashboard
```
┌───────────────────────────────────────────────────────┐
│ Dashboard                         [+ New Campaign]     │
├───────────────────────────────────────────────────────┤
│ 💰 Total Spend  📧 Messages  📊 Avg Cost  🚀 Active   │
│    $150.00         45          $3.33         3         │
├───────────────────────────────────────────────────────┤
│ Campaigns                                              │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Campaign Name    Status  Budget  Spend  Messages  │ │
│ │ Summer Sale      ACTIVE  $20     $15    12    ⏸️  │ │
│ │ Product Launch   PAUSED  $20     $8     5     ▶️  │ │
│ └───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### 3. Launch Wizard (4 Steps)
```
Step 1: Upload Video
┌─────────────────────────────┐
│  📹 Click to upload video   │
│     MP4, MOV, AVI           │
│     (max 100MB)             │
└─────────────────────────────┘
            [Next]

Step 2: Campaign Details
┌─────────────────────────────┐
│  Campaign Name: _________   │
│  Product Context:           │
│  ┌────────────────────────┐ │
│  │                        │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
  [Back]          [Next]

Step 3: Number of Ads
┌─────────────────────────────┐
│  Number of Ads: 5           │
│  [====●====] 2 ←→ 10        │
│                             │
│  ℹ️ AI will generate 5      │
│     unique variations       │
└─────────────────────────────┘
  [Back]          [Next]

Step 4: Review & Launch
┌─────────────────────────────┐
│  Video: video.mp4           │
│  Ads: 5                     │
│  Budget: $20/day            │
│  Target: Thailand, 20+      │
│                             │
│  ✅ Ready to launch          │
└─────────────────────────────┘
  [Back]    [🚀 START]
```

### 4. Campaign Detail
```
┌─────────────────────────────────────────────────────┐
│ ← Campaign Name                      [Pause] [Edit] │
├─────────────────────────────────────────────────────┤
│ 💰 $45   📧 12   ✅ 3/5   🏆 1                      │
├─────────────────────────────────────────────────────┤
│ Ad Variations                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🏆 Ad Copy (Thai)    Status  Spend  Msg  CPM   │ │
│ │    โปรโมชั่น...      ACTIVE  $12    5    $2.4 │ │
│ │    สอบถามได้...      ACTIVE  $15    4    $3.8 │ │
│ │    จำกัดเวลา...     PAUSED  $8     0    -    │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 5. Settings - Meta Connection
```
┌─────────────────────────────────────────────────┐
│ Meta Connection Settings                        │
├─────────────────────────────────────────────────┤
│ 1. Connect Facebook Account     ✅ Connected    │
│    [Reconnect Facebook]                         │
│                                                 │
│ 2. Select Ad Account                            │
│    [Ad Account 123 ▼]                          │
│                                                 │
│ 3. Select Facebook Page                         │
│    [My Business Page ▼]                        │
│                                                 │
│                              [Save Settings]    │
└─────────────────────────────────────────────────┘
```

## 📝 Meta API Sequence Diagram

### Launch Campaign Flow

```
User → Next.js API → Meta API → Database

1. POST /api/launch
   ↓
2. Validate session & Meta connection
   ↓
3. Upload video to Meta
   POST /{ad_account_id}/advideos
   ← Video ID
   ↓
4. Create Campaign
   POST /{ad_account_id}/campaigns
   {
     name: "...",
     objective: "MESSAGES",
     status: "PAUSED"
   }
   ← Campaign ID
   ↓
5. Create AdSet
   POST /act_{ad_account}/adsets
   {
     campaign_id: "...",
     targeting: {...},
     daily_budget: 2000,  # cents
     optimization_goal: "CONVERSATIONS",
     promoted_object: { page_id: "..." }
   }
   ← AdSet ID
   ↓
6. Generate N ad copies with AI
   ↓
7. For each copy:
   a) Create AdCreative
      POST /{ad_account_id}/adcreatives
      {
        object_story_spec: {
          page_id: "...",
          video_data: {
            video_id: "...",
            message: "...",
            call_to_action: {
              type: "MESSAGE_PAGE"
            }
          }
        }
      }
      ← Creative ID
   
   b) Create Ad
      POST /{ad_account_id}/ads
      {
        adset_id: "...",
        creative: { creative_id: "..." },
        status: "PAUSED"
      }
      ← Ad ID
   ↓
8. Activate all (Campaign + Ads)
   POST /{campaign_id} { status: "ACTIVE" }
   POST /{ad_id} { status: "ACTIVE" }
   ↓
9. Save to Database
   ↓
10. Return success + campaign details
```

### Optimization Flow

```
Cron Job → Next.js API → Meta API → Database

1. POST /api/cron/optimize
   Authorization: Bearer {CRON_SECRET}
   ↓
2. Get all active campaigns from DB
   ↓
3. For each campaign:
   a) Check warmup period (< 3 hours? skip)
   ↓
   b) Fetch insights from Meta
      GET /{campaign_id}/insights
      GET /{ad_id}/insights
   ↓
   c) Calculate metrics
      - median cost per message
      - average cost per message
   ↓
   d) Apply rules
      - Pause no-message ads
      - Pause high-cost ads
      - Mark winners
   ↓
   e) Execute actions via Meta API
      POST /{ad_id} { status: "PAUSED" }
   ↓
   f) Update Database
      - Update ad status
      - Save insights
      - Log decisions
   ↓
4. Return optimization summary
```

## 🔧 Setup Instructions

### 1. Clone & Install
```bash
git clone <repository>
cd download
npm install
```

### 2. Setup Database
```bash
# Update DATABASE_URL in .env.local
npx prisma generate
npx prisma db push
```

### 3. Setup Facebook App
1. ไปที่ https://developers.facebook.com/
2. สร้าง App ใหม่ (Business type)
3. เพิ่ม "Facebook Login" product
4. เพิ่ม "Marketing API" product
5. ตั้งค่า OAuth Redirect URI: `http://localhost:9002/api/meta/callback`
6. Copy App ID และ App Secret มาใส่ใน .env.local

### 4. Configure Environment
```bash
cp .env.example .env.local
# แก้ไขค่าต่างๆ ใน .env.local
```

### 5. Run Development Server
```bash
npm run dev
# เปิด http://localhost:9002
```

### 6. Setup Cron Job
1. ไปที่ https://cron-job.org/
2. สร้าง job ใหม่
3. URL: `https://your-domain.com/api/cron/optimize`
4. Method: POST
5. Headers: `Authorization: Bearer {your_CRON_SECRET}`
6. Schedule: Every 15 minutes

## 📦 Dependencies

```json
{
  "dependencies": {
    "next": "15.5.9",
    "react": "^19.2.1",
    "@prisma/client": "latest",
    "next-auth": "latest",
    "genkit": "^1.20.0",
    "@genkit-ai/google-genai": "^1.20.0",
    "zod": "latest",
    "tailwindcss": "latest"
  }
}
```

## 🚨 Important Notes

### Meta API Limitations
- **Rate Limits**: 200 calls per hour per user
- **Token Expiry**: User tokens expire in 60 days (refresh needed)
- **Business Verification**: Some features require verified business
- **Permissions**: Need admin access to ad account and page

### Optimization Best Practices
- ให้ warmup อย่างน้อย 3 ชั่วโมง
- ไม่ควรเปลี่ยน ads บ่อยเกินไป
- Monitor decision logs เพื่อดู pattern
- Adjust rules ตาม performance

### Cost Management
- ตั้ง daily budget ให้เหมาะสม
- Monitor spend real-time
- ใช้ "Pause All" button เมื่อจำเป็น
- Set up billing alerts in Facebook

## 📚 Additional Resources

- [Meta Marketing API Docs](https://developers.facebook.com/docs/marketing-apis/)
- [Facebook Ads Best Practices](https://www.facebook.com/business/ads-guide)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Documentation](https://www.prisma.io/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

## 🐛 Troubleshooting

### "Meta account not connected"
→ ไปที่ Settings → Meta Connection และกด "Connect Facebook"

### "Token expired"
→ Reconnect Facebook account ใน Settings

### "Permission denied"
→ ตรวจสอบว่ามี admin access ใน ad account และ page

### Optimization not working
→ ตรวจสอบ cron job configuration และ CRON_SECRET

---

**Built with ❤️ for efficient Facebook Messages campaigns**
