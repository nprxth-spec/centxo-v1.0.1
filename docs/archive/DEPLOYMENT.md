# Deployment Guide for Plesk Obsidian 18.0.74

Complete guide for deploying the Centxo Next.js application to Plesk hosting.

## Prerequisites

- **Node.js**: Version 18.x or higher
- **PM2**: Process manager for Node.js (`npm install -g pm2`)
- **Plesk Obsidian**: Version 18.0.74 or higher
- **Database**: PostgreSQL or MySQL configured
- **Domain**: Configured and pointing to your Plesk server

## Environment Variables Setup

### 1. Generate Required Keys

On your local machine, generate the required security keys:

```bash
# Generate ENCRYPTION_KEY (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate NEXTAUTH_SECRET
openssl rand -base64 32
```

### 2. Configure Environment Variables in Plesk

1. Log in to Plesk
2. Go to **Websites & Domains** → Your Domain → **Node.js**
3. Click **Environment Variables**
4. Add the following variables (use `env.production.example` as reference):

**Required Variables:**
- `ENCRYPTION_KEY` - Generated 64-character hex key
- `NEXTAUTH_SECRET` - Generated secret for NextAuth
- `NEXTAUTH_URL` - Your production URL (e.g., `https://yourdomain.com`)
- `DATABASE_URL` - Your database connection string
- `NODE_ENV` - Set to `production`
- `PORT` - Set to `4000` (or Plesk assigned port)

**API Keys (as needed):**
- `META_APP_ID`, `META_APP_SECRET`
- `GOOGLE_GENAI_API_KEY`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`
- Other keys from `env.production.example`

## Deployment Steps

### 1. Upload Files to Plesk

Upload your project files via FTP, Git, or Plesk File Manager to your domain's directory (e.g., `/var/www/vhosts/yourdomain.com/httpdocs/`).

### 2. Install Dependencies

SSH into your server and navigate to your project directory:

```bash
cd /var/www/vhosts/yourdomain.com/httpdocs/
npm install --production
```

### 3. Build the Application

```bash
npm run build
```

**Expected output:** Build completes successfully without errors.

If you see the ENCRYPTION_KEY error, verify that the environment variable is set correctly in Plesk.

### 4. Setup PM2 Process Manager

Create logs directory:

```bash
mkdir -p logs
```

Start the application with PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Configure Plesk Node.js Settings

1. Go to **Websites & Domains** → Your Domain → **Node.js**
2. Set **Application Mode**: Production
3. Set **Application Root**: Your project directory
4. Set **Application Startup File**: `server.js`
5. Set **Node.js Version**: 18.x or higher
6. Click **Enable Node.js**

### 6. Configure Reverse Proxy (if needed)

If using Apache/Nginx in front of Node.js:

1. Go to **Apache & nginx Settings**
2. Add to **Additional nginx directives**:

```nginx
location / {
    proxy_pass http://localhost:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Verification

### 1. Check Application Status

```bash
pm2 status
pm2 logs centxo
```

### 2. Test the Application

Visit your domain: `https://yourdomain.com`

Expected: Application loads successfully.

### 3. Health Check

Test the API endpoint:

```bash
curl https://yourdomain.com/api/health
```

## Common Issues & Troubleshooting

### Build Fails with ENCRYPTION_KEY Error

**Error:** `CRITICAL SECURITY ERROR: ENCRYPTION_KEY is using default value`

**Solution:** 
- Verify `ENCRYPTION_KEY` is set in Plesk environment variables
- Ensure the key is exactly 64 characters (32 bytes in hex)
- Restart the Node.js application after setting variables

### Application Won't Start

**Check PM2 logs:**
```bash
pm2 logs centxo --lines 100
```

**Common causes:**
- Missing environment variables
- Port already in use
- Database connection issues
- Missing dependencies

### Port Conflicts

If port 4000 is in use, change it in:
1. Plesk environment variables (`PORT=4001`)
2. `ecosystem.config.js` (update `PORT` value)
3. Restart: `pm2 restart centxo`

### Database Connection Issues

Verify `DATABASE_URL` format:
```
postgresql://username:password@localhost:5432/database_name?schema=public
```

Test connection:
```bash
npm run prisma:studio
```

## Maintenance Commands

```bash
# View logs
pm2 logs centxo

# Restart application
pm2 restart centxo

# Stop application
pm2 stop centxo

# View process status
pm2 status

# Monitor resources
pm2 monit

# Clear logs
pm2 flush
```

## Updates & Redeployment

When updating the application:

```bash
# Pull latest code (if using Git)
git pull origin main

# Install new dependencies
npm install --production

# Rebuild application
npm run build

# Restart with PM2
pm2 restart centxo
```

## Security Checklist

- ✅ `ENCRYPTION_KEY` is unique and secure (64 characters)
- ✅ `NEXTAUTH_SECRET` is set and secure
- ✅ All API keys are production keys (not test/development)
- ✅ Database credentials are secure
- ✅ HTTPS/SSL is enabled on domain
- ✅ Environment variables are not committed to Git
- ✅ `.env` files are in `.gitignore`

## Support

For issues specific to:
- **Plesk**: Check Plesk documentation or contact hosting support
- **Application**: Check application logs with `pm2 logs centxo`
- **Database**: Verify connection string and database status
- **PM2**: Visit https://pm2.keymetrics.io/docs/usage/quick-start/

## Performance Optimization

### Enable PM2 Cluster Mode

For better performance, edit `ecosystem.config.js`:

```javascript
instances: 'max', // Use all CPU cores
exec_mode: 'cluster',
```

Then restart:
```bash
pm2 restart centxo
```

### Monitor Performance

```bash
pm2 monit
```

This shows real-time CPU and memory usage.
