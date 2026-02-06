# Stripe Payment Setup

## ⚠️ สิ่งที่ต้องตั้งค่าให้ถูก

| Variable | รูปแบบที่ถูก | หาได้จาก |
|----------|-------------|----------|
| STRIPE_SECRET_KEY | `sk_live_xxx` หรือ `sk_test_xxx` | API Keys |
| STRIPE_WEBHOOK_SECRET | `whsec_xxx` | Webhooks → Signing secret |
| STRIPE_PRICE_ID_PLUS | `price_xxx` | Products → PLUS → Price ID |
| STRIPE_PRICE_ID_PRO | `price_xxx` | Products → PRO → Price ID |

**อย่าใช้ Secret Key (sk_xxx) แทน Webhook Secret หรือ Price ID**

## Stripe Dashboard Setup

### 1. สร้าง Products และ Prices

1. เข้า [Stripe Dashboard](https://dashboard.stripe.com) → **Products** → Add product
2. สร้าง **PLUS** – เพิ่ม recurring price $39/เดือน → Copy **Price ID** (price_xxx)
3. สร้าง **PRO** – เพิ่ม recurring price $99/เดือน → Copy **Price ID** (price_xxx)
4. ใส่ลงใน `.env.local`: `STRIPE_PRICE_ID_PLUS=price_xxx`, `STRIPE_PRICE_ID_PRO=price_xxx`

### 2. สร้าง Webhook

1. **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://centxo.com/api/stripe/webhook`
3. เลือก Events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. หลังสร้างแล้ว → **Reveal** Signing secret → Copy ค่า `whsec_xxx` ไปใส่ `STRIPE_WEBHOOK_SECRET`

### 3. Customer Portal (ถ้าใช้ Manage Billing)

Settings → Billing → Customer portal → เปิดใช้งาน (default ก็ใช้ได้)

## Flow

- **Upgrade**: กด Upgrade → Stripe Checkout → ชำระเงิน → Webhook อัปเดต User.plan
- **Manage**: กด Manage Subscription → Stripe Customer Portal (เปลี่ยนบัตร, ยกเลิก, ดูใบแจ้งหนี้)
