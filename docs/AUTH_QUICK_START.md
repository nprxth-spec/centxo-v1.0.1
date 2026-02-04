# 🚀 ADSER Authentication - Quick Start

## ✅ Setup Complete!

The authentication system has been fully configured with:
- ✅ NextAuth.js with Prisma adapter
- ✅ Email/Password authentication (bcrypt)
- ✅ Google OAuth
- ✅ Facebook OAuth
- ✅ Beautiful login/signup UI (matching your design)
- ✅ Protected routes middleware
- ✅ Session management

## 🔧 Next Steps

### 1. Setup Environment Variables

Create `.env` file (copy from `.env.example`):

```bash
# Database - MySQL
DATABASE_URL="mysql://user:password@localhost:3306/adser"

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:9002
NEXTAUTH_SECRET=run_openssl_rand_base64_32_to_generate

# Google OAuth (Get from https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth (Get from https://developers.facebook.com/)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# AI - Google Gemini
GOOGLE_API_KEY=your_google_api_key

# Security
ENCRYPTION_KEY=your_32_char_encryption_key_here
CRON_SECRET=your_cron_secret_key
```

### 2. Generate NEXTAUTH_SECRET

Windows (PowerShell):
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

Or use online generator: https://generate-secret.vercel.app/32

### 3. Setup Database

```bash
# Create and sync database schema
npm run prisma:push

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

### 4. Setup OAuth Providers

#### Google OAuth Setup:
1. Go to https://console.cloud.google.com/
2. Create project → Enable APIs (Google+ API)
3. Create OAuth Client ID (Web application)
4. Add redirect URI: `http://localhost:9002/api/auth/callback/google`
5. Copy Client ID and Secret to `.env`

#### Facebook OAuth Setup:
1. Go to https://developers.facebook.com/
2. Create App → Add Facebook Login
3. Add redirect URI: `http://localhost:9002/api/auth/callback/facebook`
4. Copy App ID and Secret to `.env`

**📖 Full setup guide:** See [docs/AUTH_SETUP.md](./AUTH_SETUP.md)

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:9002

## 🎨 Authentication Pages

- **Sign Up**: http://localhost:9002/signup
- **Login**: http://localhost:9002/login

## 🔐 Protected Routes

These routes require authentication (auto-redirect to login):
- `/dashboard`
- `/campaigns`
- `/launch`
- `/settings`

## 🧪 Testing

### Test Email/Password Auth:
1. Go to `/signup`
2. Enter: Name, Email, Password
3. Click "Create Account"
4. Auto-signed in → Redirect to dashboard

### Test Google OAuth:
1. Go to `/login` or `/signup`
2. Click "Continue with Google"
3. Select Google account
4. Redirect to dashboard

### Test Facebook OAuth:
1. Go to `/login` or `/signup`
2. Click "Facebook" button
3. Login with Facebook
4. Redirect to dashboard

## 📁 Key Files Created/Modified

```
app/
├── api/
│   └── auth/
│       ├── [...nextauth]/route.ts    # NextAuth configuration
│       └── register/route.ts         # Registration endpoint
├── providers/
│   └── auth-provider.tsx            # Session provider wrapper
├── login/page.tsx                   # Login page (redesigned)
├── signup/page.tsx                  # Signup page (redesigned)
└── layout.tsx                       # Root layout (updated)

middleware.ts                        # Route protection
types/next-auth.d.ts                # NextAuth types
docs/AUTH_SETUP.md                  # Complete auth guide
```

## 🎯 What Changed

### Before (Firebase Auth):
- ❌ Used Firebase SDK
- ❌ Separate auth database (Firestore)
- ❌ Different session management

### After (NextAuth):
- ✅ Unified with Prisma database
- ✅ Industry-standard NextAuth.js
- ✅ Better TypeScript support
- ✅ Easier to customize
- ✅ Better OAuth provider support

## 🐛 Troubleshooting

### "Invalid credentials" error:
- Check `.env` has correct `DATABASE_URL`
- Run `npm run prisma:push` to sync schema
- Verify password is at least 6 characters

### OAuth redirect error:
- Check redirect URIs match exactly in OAuth console
- Verify `NEXTAUTH_URL` is correct in `.env`
- Make sure app is in development mode (Facebook)

### Session not working:
- Verify `NEXTAUTH_SECRET` is set
- Clear browser cookies
- Restart dev server

## 📚 Additional Resources

- [NextAuth.js Docs](https://next-auth.js.org/)
- [Prisma Adapter](https://authjs.dev/reference/adapter/prisma)
- [Full Auth Setup Guide](./AUTH_SETUP.md)

## 🎉 You're Ready!

Authentication system is fully configured. Start the dev server and test the login/signup pages!

```bash
npm run dev
```

Visit: http://localhost:9002/login
