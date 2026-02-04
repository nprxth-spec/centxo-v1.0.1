# Authentication Setup Guide

This guide will help you set up authentication for ADSER with NextAuth, including email/password, Google OAuth, and Facebook OAuth.

## Overview

ADSER uses **NextAuth.js v4** with three authentication methods:
1. **Credentials** (Email + Password with bcrypt)
2. **Google OAuth**
3. **Facebook OAuth**

## 1. Database Setup

First, run Prisma migrations to create the required tables:

```bash
npm run prisma:push
# or
npx prisma db push
```

This creates:
- `User` table (stores user data)
- `Account` table (stores OAuth provider info)
- `Session` table (optional, for database sessions)
- `VerificationToken` table (for email verification)

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/adser"

# NextAuth
NEXTAUTH_URL=http://localhost:9002
NEXTAUTH_SECRET=your_super_secret_32_char_key_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### Generating NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

## 3. Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API** and **Google Identity Services**

### Step 2: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add authorized redirect URIs:
   ```
   http://localhost:9002/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google
   ```
5. Copy **Client ID** and **Client Secret** to `.env`

### Step 3: Configure OAuth Consent Screen

1. Go to **OAuth consent screen**
2. Choose **External** (for testing) or **Internal** (for organization only)
3. Fill in:
   - App name: **ADSER**
   - User support email: your email
   - Developer contact: your email
4. Add scopes: `email`, `profile`, `openid`
5. Add test users (if in development mode)

## 4. Facebook OAuth Setup

### Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Choose **Consumer** or **Business**
4. Fill in app details:
   - App name: **ADSER**
   - App contact email: your email

### Step 2: Configure Facebook Login

1. In your app dashboard, add **Facebook Login** product
2. Go to **Facebook Login** → **Settings**
3. Add **Valid OAuth Redirect URIs**:
   ```
   http://localhost:9002/api/auth/callback/facebook
   https://yourdomain.com/api/auth/callback/facebook
   ```
4. Save changes

### Step 3: Get App Credentials

1. Go to **Settings** → **Basic**
2. Copy **App ID** to `FACEBOOK_APP_ID` in `.env`
3. Copy **App Secret** to `FACEBOOK_APP_SECRET` in `.env`

### Step 4: Make App Public (Production Only)

1. Go to **App Review**
2. Request `email` and `public_profile` permissions
3. Switch app to **Live** mode

## 5. Testing Authentication

### Start Development Server

```bash
npm run dev
```

### Test Login Flow

1. **Sign Up with Email**
   - Go to http://localhost:9002/signup
   - Fill in: Full Name, Email, Password
   - Click "Create Account"
   - Auto-redirected to dashboard after sign up

2. **Sign In with Email**
   - Go to http://localhost:9002/login
   - Enter email and password
   - Click "Sign In"

3. **Sign In with Google**
   - Click "Google" button on login/signup page
   - Select Google account
   - Grant permissions
   - Redirected to dashboard

4. **Sign In with Facebook**
   - Click "Facebook" button on login/signup page
   - Select Facebook account or login
   - Grant permissions
   - Redirected to dashboard

## 6. Protected Routes

The following routes require authentication (enforced by `middleware.ts`):
- `/dashboard/*`
- `/campaigns/*`
- `/launch/*`
- `/settings/*`

Unauthenticated users are redirected to `/login`.

## 7. API Routes

### Registration
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

### Sign In
```typescript
import { signIn } from 'next-auth/react';

// Email/Password
await signIn('credentials', {
  email: 'john@example.com',
  password: 'securepassword123',
  redirect: false,
});

// Google OAuth
await signIn('google', {
  callbackUrl: '/dashboard',
});

// Facebook OAuth
await signIn('facebook', {
  callbackUrl: '/dashboard',
});
```

### Sign Out
```typescript
import { signOut } from 'next-auth/react';

await signOut({ callbackUrl: '/login' });
```

### Get Current Session
```typescript
import { useSession } from 'next-auth/react';

function Component() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'unauthenticated') return <div>Not signed in</div>;
  
  return <div>Signed in as {session.user.email}</div>;
}
```

## 8. Production Deployment

### Update Environment Variables

```env
NEXTAUTH_URL=https://yourdomain.com
DATABASE_URL="mysql://user:pass@host:3306/prod_db"
```

### Update OAuth Redirect URIs

Update all OAuth providers to include your production domain:
- Google: Add `https://yourdomain.com/api/auth/callback/google`
- Facebook: Add `https://yourdomain.com/api/auth/callback/facebook`

### Security Checklist

- ✅ Use strong `NEXTAUTH_SECRET` (32+ characters)
- ✅ Enable HTTPS in production
- ✅ Set `secure: true` for cookies in production
- ✅ Enable CSRF protection (enabled by default in NextAuth)
- ✅ Rate limit login attempts
- ✅ Use environment variables (never hardcode secrets)

## 9. Troubleshooting

### "Invalid credentials" error
- Check password is hashed correctly with bcrypt
- Verify email exists in database
- Check bcrypt comparison is working

### OAuth redirect error
- Verify redirect URI matches exactly in provider console
- Check `NEXTAUTH_URL` is correct
- Ensure OAuth app is published/approved

### Session not persisting
- Check `NEXTAUTH_SECRET` is set
- Verify cookies are not blocked
- Check browser allows third-party cookies

### Database connection error
- Verify `DATABASE_URL` is correct
- Check MySQL is running
- Run `npx prisma db push` to sync schema

## 10. Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Prisma Adapter Guide](https://authjs.dev/reference/adapter/prisma)

## Support

For issues, check:
1. Console logs for detailed error messages
2. Network tab for failed API requests
3. Database logs for connection issues

If problems persist, create an issue with:
- Error message
- Steps to reproduce
- Environment (Node version, OS, browser)
