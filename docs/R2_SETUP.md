# Cloudflare R2 สำหรับ Video Storage (เลิกใช้แล้ว)

> **หมายเหตุ:** ระบบเลิกใช้ Cloudflare R2 แล้ว ใช้ local storage แทน
> เอกสารด้านล่างเก็บไว้เพื่ออ้างอิงเท่านั้น

## ขั้นตอนการตั้งค่า (อ้างอิง):

### 1. สร้าง R2 Bucket
1. ไปที่ https://dash.cloudflare.com/
2. เลือก **R2** จาก sidebar
3. คลิก **Create bucket**
4. ตั้งชื่อ bucket (เช่น `my-videos`)
5. คลิก **Create bucket**

### 2. สร้าง API Token
1. ใน R2 Dashboard คลิก **Manage R2 API Tokens**
2. คลิก **Create API token**
3. ตั้งชื่อ token (เช่น `video-upload`)
4. **Permissions**: เลือก **Object Read & Write**
5. **TTL**: เลือก Forever หรือกำหนดเวลา
6. คลิก **Create API Token**
7. **คัดลอกข้อมูลทั้งหมด** (จะแสดงครั้งเดียว):
   - Access Key ID
   - Secret Access Key
   - Account ID

### 3. ตั้งค่า Public Access (Optional)
ถ้าต้องการให้วิดีโอเข้าถึงได้แบบ public:

1. เข้าไปที่ bucket ที่สร้าง
2. ไปที่แท็บ **Settings**
3. ในส่วน **Public access** คลิก **Allow Access**
4. คลิก **Connect Domain** ถ้าต้องการใช้ custom domain

### 4. เพิ่มค่าใน .env.local

เปิดไฟล์ `.env.local` แล้วเพิ่ม:

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_BUCKET_NAME=my-videos

# Optional: ถ้ามี custom domain
R2_PUBLIC_URL=https://videos.yourdomain.com
```

**ตัวอย่าง:**
```env
R2_ACCOUNT_ID=abc123def456789
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0
R2_SECRET_ACCESS_KEY=x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6
R2_BUCKET_NAME=my-videos
R2_PUBLIC_URL=https://videos.example.com
```

### 5. Restart Server
```bash
npm run dev
```

## ทดสอบ:
1. ไปที่หน้า Launch
2. อัปโหลดวิดีโอ
3. ตรวจสอบ terminal log จะเห็น "Video uploaded to R2: https://..."
4. ไปที่ R2 Dashboard จะเห็นไฟล์ในโฟลเดอร์ `videos/`

## หมายเหตุ:
- ถ้าไม่ตั้งค่า R2 ระบบจะใช้ local storage แทน
- R2 ฟรี 10GB/เดือน
- ไม่มีค่า egress (bandwidth) แบบ S3
- ใช้ S3 API ที่เข้ากันได้ 100%

## Custom Domain (Optional):
ถ้าต้องการใช้ domain ของตัวเอง:
1. ไปที่ R2 bucket > Settings > Custom Domains
2. คลิก **Connect Domain**
3. เลือก domain ที่จัดการใน Cloudflare
4. Cloudflare จะตั้งค่า DNS record อัตโนมัติ
5. เพิ่ม `R2_PUBLIC_URL=https://videos.yourdomain.com` ใน .env.local
