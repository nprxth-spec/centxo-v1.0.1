# Data Management Standard — มาตรฐานการจัดการข้อมูล

เอกสารนี้อธิบายแนวทางมาตรฐานการจัดการข้อมูลของ Centxo เพื่อให้ทุกหน้าง่ายต่อการดูแลและมี UX ที่สม่ำเสมอ

---

## 1. โครงสร้างชั้นข้อมูล (Data Layer)

### 1.1 ระดับความสำคัญของข้อมูล

| ระดับ | ประเภทข้อมูล | ที่เก็บ | ตัวอย่าง |
|-------|-------------|--------|----------|
| **Global** | ใช้ร่วมกันหลายหน้า | Context | Ad Accounts, Pages, Businesses, Session |
| **Page** | เฉพาะหน้านั้น | useState / Custom Hook | Campaigns, Ad Sets, Ads, Dashboard Stats |
| **Form** | ชั่วคราวระหว่างกรอก | useState | Create Ads form, Settings form |

### 1.2 แหล่งข้อมูล (Source of Truth)

- **AdAccountContext** → บัญชีโฆษณา, เพจ, ธุรกิจ (จาก `/api/team/ad-accounts`, `/api/team/config`)
- **API Routes** → Campaigns, Ad Sets, Ads, Dashboard, Audiences (จาก Meta API + Redis cache)
- **localStorage** → การเลือกของ user (selected accounts, date range, visible columns)

---

## 2. รูปแบบการ Fetch ข้อมูล (Fetch Patterns)

### 2.1 แบบที่ 1: ข้อมูล Global (Context)

ใช้กับข้อมูลที่หลายหน้าใช้ร่วมกัน เช่น Ad Accounts, Pages

```
Provider → useEffect + fetch → setState → Consumer
```

- **Cache:** In-memory + Redis (server), localStorage (client)
- **Refresh:** refreshData(force?, { bypassCooldown? })
- **ตัวอย่าง:** AdAccountContext

### 2.2 แบบที่ 2: หน้ามี List + Pagination

ใช้กับ Campaigns, Ad Sets, Ads, Audiences

```
Page → fetch(limit, offset) → setItems, setTotal → แสดง 50 แถว/หน้า
```

- **Cache:** Redis (server) ด้วย first-page-only เมื่อ limit ≤ 500
- **Pagination:** 50 แถว/หน้า, ปุ่ม Previous/Next
- **Refresh:** ปุ่ม Refresh, เปลี่ยนบัญชี/วันที่/ตัวกรอง → reset ไปหน้า 1

### 2.3 แบบที่ 3: หน้ามี List เล็ก (ไม่ paginate)

ใช้กับหน้าเช่น Settings, Dropdown options

```
Page → useEffect → fetch → setItems
```

- **Cache:** ตาม API (Redis หรือไม่มี)
- **Refresh:** เมื่อ mount หรือหลังจาก mutation สำเร็จ

### 2.4 แบบที่ 4: Staged Loading (โหลดทีละส่วน)

ใช้เมื่อมีหลายแท็บ/ส่วนที่โหลดพร้อมกัน แต่ต้องการแสดงผลเร็ว

```
Stage 1: fetch A → แสดง A ทันที
Stage 2: fetch B, C แบบ parallel → แสดง B, C เมื่อโหลดเสร็จ
```

- **ตัวอย่าง:** Campaigns page (Campaigns ก่อน → Ad Sets + Ads ตาม)

---

## 3. Loading & Error States

### 3.1 รูปแบบ State มาตรฐาน

```ts
// List/Table pages
const [items, setItems] = useState<T[]>([]);
const [loading, setLoading] = useState(true);   // หรือแยกเป็น itemsLoading ถ้ามีหลายส่วน
const [error, setError] = useState<string | null>(null);

// Pagination
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);
const PAGE_SIZE = 50;
```

### 3.2 การแสดง Loading

| ประเภท | การแสดง |
|--------|---------|
| หน้า/ตาราง | Skeleton rows (10 แถว animate-pulse) |
| ปุ่ม/Action | Spinner ข้างปุ่ม, disabled |
| Modal/Dialog | Spinner ตรงกลาง |
| Pull-to-refresh | ปุ่ม Refresh แสดง animate-spin |

### 3.3 การแสดง Error

- แสดง Toast (ใช้ `showErrorToast`) สำหรับ error ทั่วไป
- แสดง Alert ในหน้าสำหรับ error ที่สำคัญ (เช่น "ไม่สามารถโหลดข้อมูลได้")
- ล้าง error เมื่อ fetch ใหม่สำเร็จ

---

## 4. Caching Strategy

### 4.1 Server-side (API Routes)

| Endpoint | TTL | หมายเหตุ |
|----------|-----|----------|
| team/ad-accounts | 1 ชม. | Invalidate เมื่อเชื่อมต่อ Facebook ใหม่ |
| team/config | 2 ชม. | เหมือนด้านบน |
| dashboard/stats | 10 นาที | |
| campaigns, adsets, ads | 5 นาที (SWR) | First-page-only เมื่อ limit ≤ 500 |
| team/facebook-pictures | 1 ชม. | |

### 4.2 Client-side

| ข้อมูล | ที่เก็บ | TTL/พฤติกรรม |
|--------|--------|---------------|
| Ad Accounts, Pages | AdAccountContext | 2 ชม. + refresh cooldown 15 นาที |
| Selected accounts | localStorage | ยาวนาน |
| Date range, columns | localStorage | ยาวนาน |
| Campaigns page | ใช้ cache จาก API | ไม่ cache ฝั่ง client (refetch เมื่อเปลี่ยน page) |

---

## 5. Pagination Standard

### 5.1 ค่ามาตรฐาน

- **PAGE_SIZE:** 50 แถว/หน้า
- **API params:** `limit=50`, `offset=(page-1)*50`

### 5.2 UI

- แสดง "Showing 1-50 of 200"
- ปุ่ม Previous, Next (disabled เมื่อหน้าแรก/สุดท้าย)
- Reset เป็นหน้า 1 เมื่อเปลี่ยน filter/date/accounts

### 5.3 API Behavior

- โหมด paginate: ดึง **แค่หน้าแรก** จาก Meta (first-page-only) เพื่อความเร็ว
- Cache ผลลัพธ์เต็มของหน้าแรก แล้ว slice ตาม offset
- คืนค่า `total`, `hasMore` เพื่อให้ frontend แสดง pagination ได้ถูกต้อง

---

## 6. Refresh Patterns

### 6.1 Manual Refresh

- ปุ่ม Refresh มี cooldown (เช่น 5 นาที) เพื่อลด Meta API calls
- สามารถ bypass cooldown ได้เมื่อจำเป็น (เช่น เพิ่งเชื่อมต่อ Facebook)
- กด Refresh → reset page เป็น 1 (ถ้ามี pagination)

### 6.2 Auto Refresh / Polling

- ใช้เฉพาะหน้าที่ต้อง real-time (เช่น Campaigns ทุก 15 วินาที)
- ใช้ `silent=true` เพื่อไม่ให้แสดง loading ซ้ำ
- หยุด polling เมื่อ `document.hidden` (tab ไม่โฟกัส)

### 6.3 Invalidation

- เชื่อมต่อ/ตัด Facebook → invalidate `team/*` cache
- สร้าง/แก้/ลบ Campaign/Ad → refresh ข้อมูลที่เกี่ยวข้อง

---

## 7. โครงสร้างโค้ดที่แนะนำ

### 7.1 Custom Hook สำหรับ List + Pagination

ใช้ `src/hooks/usePaginatedList.ts` สำหรับหน้ารายการที่มี pagination

```ts
import { usePaginatedList } from '@/hooks/usePaginatedList';

const { items, loading, page, total, pageSize, hasMore, loadPage } = usePaginatedList({
  pageSize: 50,
  fetchFn: async ({ limit, offset }) => {
    const res = await fetch(`/api/items?limit=${limit}&offset=${offset}`);
    const data = await res.json();
    return { items: data.items, total: data.total };
  },
  formatItem: (raw) => ({ ...raw, createdAt: new Date(raw.createdAt).toLocaleDateString() }),
});
```

### 7.2 โครงสร้าง State ใน Page

```ts
// 1. Data
const [items, setItems] = useState<Item[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// 2. Pagination (ถ้ามี)
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);

// 3. Fetch
const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      setItems(data.items);
      setTotal(data.total);
    } else setError(data.error || 'Failed');
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Failed');
  } finally {
    setLoading(false);
  }
}, [deps]);

// 4. Effect
useEffect(() => {
  if (shouldFetch) fetchData();
}, [shouldFetch, fetchData]);
```

---

## 8. Checklist สำหรับหน้าใหม่

- [ ] ใช้ Context ถ้าข้อมูลใช้ร่วมกันหลายหน้า
- [ ] ใช้ loading state และแสดง skeleton/spinner
- [ ] จัดการ error (Toast หรือ Alert)
- [ ] ถ้า list มากกว่า 50 รายการ → ใช้ pagination
- [ ] ใช้ PAGE_SIZE = 50 และ limit/offset ใน API
- [ ] Reset page เป็น 1 เมื่อ filter/accounts/date เปลี่ยน
- [ ] ถ้าโหลดช้า → พิจารณา staged loading หรือ first-page-only
- [ ] เก็บการเลือกของ user ใน localStorage ถ้าเหมาะสม

---

## 9. สรุป Quick Reference

| สถานการณ์ | แนวทาง |
|-----------|--------|
| ข้อมูล global (accounts, pages) | AdAccountContext + refreshData |
| List มาก (campaigns, ads) | Pagination 50/หน้า + first-page-only API |
| List น้อย (settings, options) | useEffect + fetch ตรงๆ |
| หลายส่วนโหลดพร้อมกัน | Staged loading (โหลดส่วนสำคัญก่อน) |
| ต้อง real-time | Polling ทุก 15s + silent refresh |
| หลัง mutation (สร้าง/แก้/ลบ) | Refetch ข้อมูลที่เกี่ยวข้อง หรือ invalidate cache |
