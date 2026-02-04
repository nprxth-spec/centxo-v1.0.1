# Plesk Deployment Guide for centxo.com

## ปัญหาที่พบและวิธีแก้

### 1. Environment Variables ไม่โหลด
**สาเหตุ:** Plesk ไม่ได้อ่านไฟล์ `.env` โดยอัตโนมัติ

**วิธีแก้:**
1. ไปที่ **Websites & Domains** → เลือก `centxo.com`
2. คลิก **Node.js**
3. ในส่วน **Environment Variables** ให้เพิ่มตัวแปรทั้งหมดจากไฟล์ `PLESK_ENV_VARS.txt`
4. **สำคัญ:** ต้องตั้ง `NODE_ENV=production` เพื่อให้รันใน production mode
5. คลิก **Apply** และ **Restart App**

### 2. เว็บโหลดช้า
**สาเหตุ:** 
- รันใน development mode (`NODE_ENV` ไม่ได้ตั้งเป็น `production`)
- ยังไม่ได้ build Next.js

**วิธีแก้:**
1. ตั้ง `NODE_ENV=production` ใน Plesk Environment Variables
2. รัน build commands:
   ```bash
   npm install
   npm run build
   ```
3. Restart Node.js app ใน Plesk

### 3. Database Connection Failed
**สาเหตุ:** Prisma Client ยังไม่ได้ถูก generate

**วิธีแก้:** 
- ไม่ต้องทำอะไร! `package.json` ได้ถูกแก้ไขให้รัน `prisma generate` และ `prisma db push` อัตโนมัติตอน build แล้ว

## ขั้นตอน Deploy บน Plesk

### 1. Pull Code จาก GitHub
```bash
cd /var/www/vhosts/centxo.com/httpdocs
git pull origin main
```

### 2. Install Dependencies
```bash
npm install
```
(จะรัน `prisma generate` อัตโนมัติผ่าน `postinstall` script)

### 3. Build Application
```bash
npm run build
```
(จะรัน `prisma generate`, `prisma db push`, และ `next build` อัตโนมัติ)

### 4. ตั้งค่า Environment Variables ใน Plesk UI
- ไปที่ **Node.js** settings
- เพิ่มตัวแปรทั้งหมดจาก `PLESK_ENV_VARS.txt`
- **อย่าลืม:** `NODE_ENV=production`

### 5. Restart Application
- คลิก **Restart App** ใน Plesk Node.js settings
- หรือใช้ PM2: `pm2 restart all`

## ตรวจสอบว่า Deploy สำเร็จ

1. **เช็ค Logs:**
   ```bash
   pm2 logs
   # หรือ
   tail -f /var/www/vhosts/centxo.com/logs/error_log
   ```

2. **ดูว่ารันใน Production Mode:**
   - ใน logs ควรเห็น: `> Environment: production`

3. **ทดสอบเว็บ:**
   - เปิด https://www.centxo.com
   - ควรโหลดเร็ว (ไม่เกิน 2-3 วินาที)
   - ลอง login ด้วย Google/Facebook

## Troubleshooting

### เว็บยังโหลดช้า
- เช็คว่า `NODE_ENV=production` ตั้งค่าถูกต้องหรือไม่
- ดู logs: `pm2 logs` หรือ `tail -f error_log`
- ลอง restart: `pm2 restart all`

### Database Connection Error
- เช็ค `DATABASE_URL` ใน Plesk Environment Variables
- ลองรัน: `npx prisma db push` ด้วยตัวเอง

### Google OAuth Error (redirect_uri_mismatch)
- ไปที่ Google Cloud Console
- เพิ่ม redirect URI: `https://www.centxo.com/api/auth/callback/google`
- รอ 5-10 นาที แล้วลองใหม่

## Files สำคัญ

- `server.js` - Custom server สำหรับ Plesk
- `package.json` - Build scripts (รัน Prisma commands อัตโนมัติ)
- `PLESK_ENV_VARS.txt` - Template สำหรับ Environment Variables
