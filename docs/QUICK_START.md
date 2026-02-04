# 🚀 Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- MySQL database (local or cloud)
- Facebook Developer Account
- Google API Key (for Gemini AI)

---

## Step 1: Clone & Install

```bash
# Navigate to project directory
cd c:\Users\ADMINSER\Desktop\download

# Install dependencies
npm install

# Install Prisma CLI if needed
npm install -g prisma
```

---

## Step 2: Setup Facebook App

### 2.1 Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Business" type
4. Name your app (e.g., "Messages Ads Launcher")
5. Click "Create App"

### 2.2 Add Products

**Add Facebook Login:**
1. Dashboard → Add Product
2. Find "Facebook Login" → Set Up
3. Select "Web" platform
4. Add redirect URL: `http://localhost:9002/api/meta/callback`
5. Save

**Add Marketing API:**
1. Dashboard → Add Product
2. Find "Marketing API" → Set Up
3. Request standard access (if needed)

### 2.3 Get Credentials

1. Dashboard → Settings → Basic
2. Copy **App ID**
3. Copy **App Secret** (click "Show")
4. Save these for later

### 2.4 Configure OAuth

1. Facebook Login → Settings
2. Valid OAuth Redirect URIs: `http://localhost:9002/api/meta/callback`
3. Save Changes

---

## Step 3: Setup Database

### 3.1 Create MySQL Database

**Option A: Local MySQL**
```sql
CREATE DATABASE messages_ads_launcher;
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON messages_ads_launcher.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
```

**Option B: Cloud Database (TiDB Cloud, PlanetScale, etc.)**
- Create new database
- Copy connection string

### 3.2 Update `.env.local`

```bash
# Copy example file
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Meta/Facebook App
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
FACEBOOK_REDIRECT_URI=http://localhost:9002/api/meta/callback

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:9002
NEXTAUTH_SECRET=run_this_command_to_generate_secret

# Database (MySQL)
DATABASE_URL="mysql://app_user:your_password@localhost:3306/messages_ads_launcher"

# AI Provider (Google Gemini)
GOOGLE_API_KEY=your_google_api_key_here

# Security Keys (generate these)
ENCRYPTION_KEY=generate_32_char_hex_string
CRON_SECRET=generate_random_base64_string
```

### 3.3 Generate Secrets

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

**Generate ENCRYPTION_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate CRON_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the outputs and paste into `.env.local`

---

## Step 4: Initialize Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema to database
npm run prisma:push

# Open Prisma Studio (optional - to view data)
npm run prisma:studio
```

---

## Step 5: Get Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Create new API key
4. Copy and paste into `.env.local` as `GOOGLE_API_KEY`

---

## Step 6: Start Development Server

```bash
npm run dev
```

Server will start at: http://localhost:9002

---

## Step 7: Create First User

### Option A: Manual Database Insert

```sql
-- Generate password hash (use bcrypt online tool with cost 10)
-- Password: admin123
-- Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

INSERT INTO User (id, email, password, createdAt, updatedAt)
VALUES (
  'user_1',
  'admin@example.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  NOW(),
  NOW()
);
```

### Option B: Create Signup Page

Visit: http://localhost:9002/signup (if implemented)

---

## Step 8: Login & Connect Facebook

1. Go to http://localhost:9002/login
2. Login with your credentials
3. Go to Settings → Meta Connection
4. Click "Connect Facebook"
5. Authorize the app
6. Select Ad Account and Page
7. Save Settings

---

## Step 9: Launch First Campaign

1. Go to Dashboard
2. Click "New Campaign"
3. Follow 4-step wizard:
   - Upload video
   - Enter campaign details
   - Select number of ads (3-5 recommended)
   - Review and launch
4. Click "START"
5. Wait for campaign to be created (~30 seconds)
6. View campaign in dashboard

---

## Step 10: Setup Cron Job (Optional for Auto-Optimization)

### Option A: Local Testing (node-cron)

Create `cron.js`:
```javascript
const cron = require('node-cron');
const fetch = require('node-fetch');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    const response = await fetch('http://localhost:9002/api/cron/optimize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    });
    
    const data = await response.json();
    console.log('Optimization result:', data);
  } catch (error) {
    console.error('Cron error:', error);
  }
});

console.log('Cron job started');
```

Run:
```bash
node cron.js
```

### Option B: Production (cron-job.org)

1. Go to https://cron-job.org/
2. Create free account
3. Create new cron job:
   - **Title**: Messages Ads Optimizer
   - **URL**: `https://your-production-domain.com/api/cron/optimize`
   - **Schedule**: Every 15 minutes
   - **Request method**: POST
   - **Custom headers**:
     - Key: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET`
4. Enable and test

---

## Testing

### Test Meta Connection
```bash
curl http://localhost:9002/api/meta/connect
```

Expected: JSON with `authUrl`

### Test Campaign Creation
```bash
curl -X POST http://localhost:9002/api/launch \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "videoPath": "/test.mp4",
    "pageId": "YOUR_PAGE_ID",
    "numberOfAds": 3,
    "campaignName": "Test Campaign",
    "dailyBudget": 20
  }'
```

### Test Optimization
```bash
curl -X POST http://localhost:9002/api/cron/optimize \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Common Issues & Solutions

### Issue: "Meta account not connected"
**Solution:** 
1. Go to Settings → Meta Connection
2. Click "Connect Facebook"
3. Complete OAuth flow

### Issue: "Token expired"
**Solution:**
1. Reconnect Facebook account in Settings
2. Tokens expire after 60 days

### Issue: "Permission denied" when creating campaign
**Solution:**
1. Verify you're admin of the ad account
2. Check page has ADVERTISE permission
3. Re-authorize the app

### Issue: "Database connection error"
**Solution:**
1. Check `DATABASE_URL` in `.env.local`
2. Verify MySQL is running
3. Test connection: `npx prisma db pull`

### Issue: "AI generation failed"
**Solution:**
1. Check `GOOGLE_API_KEY` is valid
2. Verify API quota not exceeded
3. Check network connection

### Issue: Cron job not running
**Solution:**
1. Verify `CRON_SECRET` matches in both places
2. Check cron service configuration
3. Test manually: `POST /api/cron/optimize`

---

## Project Structure Overview

```
download/
├── app/                    # Next.js App Router
│   ├── (app)/             # Protected routes
│   │   ├── dashboard/     # Main dashboard
│   │   ├── launch/        # Campaign wizard
│   │   ├── campaigns/     # Campaign details
│   │   └── settings/      # Settings pages
│   └── api/               # API routes
│       ├── launch/        # Launch endpoint
│       ├── campaigns/     # Campaign CRUD
│       ├── ads/           # Ad management
│       ├── meta/          # Meta OAuth
│       └── cron/          # Optimization
├── lib/
│   └── services/          # Business logic
│       ├── metaClient.ts      # Meta API
│       ├── aiCopyService.ts   # AI generation
│       └── optimizer.ts       # Auto-optimization
├── prisma/
│   └── schema.prisma      # Database schema
└── docs/                  # Documentation
```

---

## Next Steps

1. **Add Users**: Create additional user accounts
2. **Launch Campaigns**: Create and test campaigns
3. **Monitor Performance**: Watch dashboard for metrics
4. **Optimize**: Let auto-optimizer run for 24 hours
5. **Scale**: Increase daily budget for winners
6. **Deploy**: Deploy to Vercel/production

---

## Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run prisma:studio          # Open Prisma Studio

# Database
npm run prisma:generate        # Generate Prisma Client
npm run prisma:push            # Push schema changes
npx prisma migrate dev         # Create migration

# Build
npm run build                  # Build for production
npm start                      # Start production server

# Maintenance
npm run lint                   # Run linter
npm run typecheck              # Check TypeScript
npm audit                      # Security audit
```

---

## Support & Resources

- **Documentation**: `/docs/README.md`
- **API Docs**: `/docs/API_DOCUMENTATION.md`
- **Security**: `/docs/SECURITY.md`
- **Meta API**: https://developers.facebook.com/docs/marketing-apis/
- **Next.js**: https://nextjs.org/docs

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Update `FACEBOOK_REDIRECT_URI` to production domain
- [ ] Set all environment variables in hosting platform
- [ ] Enable HTTPS
- [ ] Setup domain and SSL certificate
- [ ] Configure cron job with production URL
- [ ] Setup database backups
- [ ] Configure monitoring and alerts
- [ ] Add error tracking (Sentry, etc.)
- [ ] Review and update CORS settings
- [ ] Test OAuth flow on production domain
- [ ] Test campaign creation end-to-end
- [ ] Verify cron job executes successfully

---

**🎉 Congratulations! Your Messages Ads Launcher is ready to use!**

For questions or issues, check the documentation or create an issue in the repository.
