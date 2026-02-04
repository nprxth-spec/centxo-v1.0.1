# Security Implementation Guide

## 🔐 Overview

This document outlines the security measures implemented in the AI Auto Messages Ads Launcher application.

---

## 1. Token Encryption

### Implementation

All Meta/Facebook access tokens are encrypted before storage using AES-256-CBC.

**Location:** `lib/services/metaClient.ts`

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    iv
  );
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    iv
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Best Practices

1. **Generate secure encryption key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Store in environment variables:**
   ```env
   ENCRYPTION_KEY=your_64_character_hex_string
   ```

3. **Rotate keys periodically** (every 90 days recommended)

4. **Never commit keys** to version control

---

## 2. Authentication & Authorization

### NextAuth Implementation

**Location:** `app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        
        if (!user || !user.password) {
          return null;
        }
        
        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        
        if (!isValid) {
          return null;
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### Session Validation

All API routes check authentication:

```typescript
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Continue with authorized request...
}
```

### Authorization Checks

**Ownership verification:**

```typescript
// Check if user owns the campaign
const campaign = await prisma.campaign.findUnique({
  where: { id: campaignId },
  include: {
    metaAccount: {
      include: { user: true }
    }
  }
});

if (campaign.metaAccount.user.email !== session.user.email) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## 3. API Security

### Cron Endpoint Protection

**Location:** `app/api/cron/optimize/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Continue with optimization...
}
```

### Setup Instructions

1. Generate secure secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. Add to `.env.local`:
   ```env
   CRON_SECRET=your_generated_secret
   ```

3. Configure cron service (cron-job.org):
   - URL: `https://your-domain.com/api/cron/optimize`
   - Method: POST
   - Header: `Authorization: Bearer your_generated_secret`

---

## 4. Input Validation

### Zod Schema Validation

**Example: Launch campaign validation**

```typescript
import { z } from 'zod';

const launchCampaignSchema = z.object({
  videoPath: z.string().min(1, 'Video path is required'),
  pageId: z.string().min(1, 'Page ID is required'),
  numberOfAds: z.number().int().min(1).max(10),
  campaignName: z.string().optional(),
  dailyBudget: z.number().min(1).max(1000).default(20),
  productContext: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Validate input
  const validation = launchCampaignSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { 
        error: 'Validation failed',
        details: validation.error.errors 
      },
      { status: 400 }
    );
  }
  
  const data = validation.data;
  // Continue with validated data...
}
```

---

## 5. Audit Logging

### Implementation

**Database schema:**

```prisma
model AuditLog {
  id           String   @id @default(cuid())
  userId       String?
  action       String   // "CREATE_CAMPAIGN", "PAUSE_AD", etc.
  entityType   String?
  entityId     String?
  campaignId   String?
  campaign     Campaign? @relation(fields: [campaignId], references: [id])
  adId         String?
  ad           Ad?      @relation(fields: [adId], references: [id])
  details      Json?
  ipAddress    String?
  userAgent    String?  @db.Text
  createdAt    DateTime @default(now())
  
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

**Logging function:**

```typescript
async function logAudit(params: {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  campaignId?: string;
  adId?: string;
  details?: any;
  request: NextRequest;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      campaignId: params.campaignId,
      adId: params.adId,
      details: params.details || {},
      ipAddress: params.request.headers.get('x-forwarded-for') || 
                 params.request.headers.get('x-real-ip'),
      userAgent: params.request.headers.get('user-agent'),
    },
  });
}
```

### What to Log

✅ **Always log:**
- Campaign creation/updates
- Ad status changes
- Meta API calls
- Authentication events
- Permission denials
- Errors and exceptions

❌ **Never log:**
- Passwords
- Access tokens (raw)
- Credit card numbers
- Personal data (unless necessary)

---

## 6. Rate Limiting

### Meta API Rate Limits

- **200 calls/hour** per user token
- **4,800 calls/hour** per app

### Implementation Strategy

```typescript
class RateLimiter {
  private calls: Map<string, number[]> = new Map();
  
  async checkLimit(key: string, maxCalls: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const calls = this.calls.get(key) || [];
    
    // Remove old calls outside window
    const validCalls = calls.filter(time => now - time < windowMs);
    
    if (validCalls.length >= maxCalls) {
      return false; // Rate limit exceeded
    }
    
    validCalls.push(now);
    this.calls.set(key, validCalls);
    return true;
  }
}

const limiter = new RateLimiter();

// Usage in API route
const canProceed = await limiter.checkLimit(
  userId,
  200, // max calls
  60 * 60 * 1000 // 1 hour
);

if (!canProceed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  );
}
```

### Retry Logic with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.code === 'RATE_LIMIT_EXCEEDED' && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 7. HTTPS & Transport Security

### Production Requirements

1. **Force HTTPS:**
   ```javascript
   // next.config.js
   module.exports = {
     async headers() {
       return [
         {
           source: '/:path*',
           headers: [
             {
               key: 'Strict-Transport-Security',
               value: 'max-age=63072000; includeSubDomains; preload'
             }
           ]
         }
       ];
     }
   };
   ```

2. **CSP Headers:**
   ```javascript
   {
     key: 'Content-Security-Policy',
     value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
   }
   ```

3. **X-Frame-Options:**
   ```javascript
   {
     key: 'X-Frame-Options',
     value: 'DENY'
   }
   ```

---

## 8. Database Security

### Prisma Best Practices

1. **Use parameterized queries** (built-in with Prisma)

2. **Least privilege database user:**
   ```sql
   CREATE USER 'app_user'@'%' IDENTIFIED BY 'strong_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON database.* TO 'app_user'@'%';
   ```

3. **Connection pooling:**
   ```env
   DATABASE_URL="mysql://user:pass@host:3306/db?connection_limit=10"
   ```

4. **Regular backups:**
   ```bash
   # Daily backup cron
   0 2 * * * mysqldump -u user -p database > backup_$(date +\%Y\%m\%d).sql
   ```

---

## 9. Environment Variables Security

### Required Variables

```env
# Critical - MUST be unique and secure
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
ENCRYPTION_KEY=generate_with_crypto_randomBytes_32
CRON_SECRET=generate_with_crypto_randomBytes_32

# Meta/Facebook
FACEBOOK_APP_ID=from_facebook_developers
FACEBOOK_APP_SECRET=from_facebook_developers
FACEBOOK_REDIRECT_URI=https://your-domain.com/api/meta/callback

# Database
DATABASE_URL="mysql://user:password@host:3306/database"

# AI
GOOGLE_API_KEY=your_api_key
```

### Security Checklist

- [ ] All secrets generated with cryptographically secure methods
- [ ] `.env.local` added to `.gitignore`
- [ ] Production secrets stored in hosting platform (Vercel, etc.)
- [ ] Secrets rotated every 90 days
- [ ] No secrets in client-side code
- [ ] No secrets in logs or error messages

---

## 10. Incident Response

### If Token Compromised

1. **Immediately revoke** Facebook app access tokens
2. **Generate new** `ENCRYPTION_KEY`
3. **Re-encrypt** all existing tokens
4. **Force re-authentication** for all users
5. **Review audit logs** for unauthorized access
6. **Notify affected users**

### If Database Compromised

1. **Change database password** immediately
2. **Review audit logs** for suspicious activity
3. **Backup current data**
4. **Scan for SQL injection** vulnerabilities
5. **Update Prisma** and dependencies
6. **Notify users** if data was accessed

### Monitoring

Set up alerts for:
- Failed login attempts (> 5 in 10 minutes)
- Unusual API call patterns
- Database connection errors
- Cron job failures
- Rate limit hits

---

## 11. Compliance

### GDPR Requirements

✅ **Implemented:**
- User data deletion endpoint: `/data-deletion`
- Audit logs for data access
- Token encryption at rest
- Data minimization (only store necessary data)

❌ **TODO:**
- Cookie consent banner
- Privacy policy page
- Terms of service
- Data export functionality

### Facebook Platform Policy

✅ **Compliance:**
- User consent for data access
- Clear purpose communication
- Secure token storage
- Data deletion on request
- Terms of service acceptance

---

## 12. Security Checklist

### Pre-Launch

- [ ] All secrets are unique and secure
- [ ] HTTPS enforced in production
- [ ] Security headers configured
- [ ] Input validation on all endpoints
- [ ] Authentication on all protected routes
- [ ] Audit logging implemented
- [ ] Error messages don't leak sensitive info
- [ ] Database user has minimal privileges
- [ ] Backup strategy in place
- [ ] Monitoring and alerting configured

### Regular Maintenance

- [ ] Review audit logs weekly
- [ ] Rotate secrets quarterly
- [ ] Update dependencies monthly
- [ ] Security scan with `npm audit`
- [ ] Review access permissions
- [ ] Test backup restoration
- [ ] Penetration testing annually

---

## 13. Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Meta Platform Policy](https://developers.facebook.com/docs/development/release/policies/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [Prisma Security](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)

---

**Security is an ongoing process, not a one-time implementation. Stay vigilant! 🔒**
