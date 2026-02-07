# Google Sheets Export

## ภาพรวม

Google Sheets Export ช่วยส่งออกข้อมูลโฆษณาจาก Facebook/Meta ไปยัง Google Sheets โดยอัตโนมัติ สามารถตั้งค่า Column Mapping ได้ตามต้องการ และรองรับการส่งออกอัตโนมัติ (Auto Export) ตามกำหนดเวลา

---

## การทำงานหลัก

### 1. ส่งเฉพาะรายการที่มีข้อมูลสถิติ

**ระบบจะส่งออกเฉพาะ AD ID (หรือ Campaign/AdSet ID) ที่มีข้อมูลสถิติ (Insights) ในช่วงวันที่ที่เลือกเท่านั้น**

- ถ้าโฆษณาไม่มี Reach, Impressions, Spend, Clicks, Engagement หรือ Message ในช่วงวันที่ที่เลือก → **จะไม่ถูกส่งออก**
- ข้อมูลสถิติดึงจาก Facebook Insights API ตามวันที่ที่ผู้ใช้เลือก
- ช่วยให้ข้อมูลใน Sheet สะอาด ไม่มีแถวว่างเปล่า

### 2. วันที่ของข้อมูล

- **Manual Export:** ใช้วันที่ที่ผู้ใช้เลือกในปฏิทิน
- **Auto Export:** ใช้วันที่ปัจจุบัน (วันที่มีการรัน export)
- รูปแบบวันที่ในคอลัมน์ A: `DD/MM/YYYY` (เช่น 26/01/2026)

### 3. แหล่งบัญชีโฆษณา

บัญชีโฆษณาที่แสดงในขั้นตอน "Select Account & Data Type" มาจาก **Settings → Connections → Ad Accounts** (การเลือกที่ผู้ใช้ทำไว้)

- ต้องไปที่ [Settings → Connections → Ad Accounts](http://localhost:3000/settings/connections?tab=ad-accounts) เพื่อเลือกบัญชีโฆษณาก่อน
- ถ้ายังไม่มีบัญชีที่เลือก ระบบจะแสดงบัญชีทั้งหมดที่มี

---

## คอลัมน์เริ่มต้น (Default Column Mapping)

| คอลัมน์ | ฟิลด์ | คำอธิบาย |
|--------|-------|----------|
| A | Date | วันที่ของข้อมูล (ตามวันที่ที่เลือก) |
| B | AD ID | รหัสโฆษณา |
| C | Skip | ข้าม (ว่าง) |
| D | Account Name | ชื่อบัญชีโฆษณา |
| E | Skip | ข้าม (ว่าง) |
| F | Reach | การเข้าถึง (Reach) |
| G | Impression | การแสดงผล (Impressions) |
| H | Engagement | การมีส่วนร่วมกับโพสต์ |
| I | Clicks | จำนวนคลิก |
| J | Message | การสนทนาข้อความใหม่ |
| K | Cost | จำนวนเงินที่ใช้จ่าย (Spend) |
| L | Skip | ข้าม (ว่าง) |
| M | VDO Average Play time | เวลาเฉลี่ยที่ดูวิดีโอ |
| N | Video Plays | จำนวนการเล่นวิดีโอ |
| O | 3 Second Video Plays | การเล่นวิดีโอ 3 วินาที |
| P | VDO Plays at 25% | การเล่นวิดีโอที่ 25% |
| Q | VDO Plays at 50% | การเล่นวิดีโอที่ 50% |
| R | VDO Plays at 75% | การเล่นวิดีโอที่ 75% |
| S | VDO Plays at 95% | การเล่นวิดีโอที่ 95% |
| T | VDO Plays at 100% | การเล่นวิดีโอที่ 100% |

---

## ขั้นตอนการใช้งาน

### Step 1: เลือกบัญชีและประเภทข้อมูล
- เลือกบัญชีโฆษณาที่ต้องการส่งออก (จาก Settings → Connections)
- เลือกประเภทข้อมูล: Ads, Campaigns, AdSets หรือ Accounts

### Step 2: เชื่อมต่อ Google Sheet (v2 - Google Picker)
- กดปุ่ม **"เลือก Google Sheet จาก Drive"** เพื่อเปิด Google Picker
- เลือกไฟล์ Google Sheet ที่ต้องการส่งออกจาก Google Drive
- ระบบจะดึงรายชื่อ Sheet (Tab) อัตโนมัติ
- เลือกชื่อ Sheet (Tab) ที่จะเขียนข้อมูล
- *ใช้ `drive.file` scope แทน `spreadsheets` ตามคำแนะนำของ Google*

### Step 3: ตั้งค่าการส่งออก
- **Column Mapping:** ปรับแมปปิ้งคอลัมน์ได้ตามต้องการ (หรือใช้ค่าเริ่มต้น)
- **เลือกวันที่:** เลือกวันที่ของข้อมูลที่จะส่งออก (ข้อมูล Insights จะดึงเฉพาะช่วงวันที่นี้)
- **Append Mode:** เปิด = ต่อท้ายข้อมูลเดิม, ปิด = ล้างและเขียนใหม่
- **Auto Export:** ตั้งค่าส่งออกอัตโนมัติตามเวลา (ถ้าต้องการ)

---

## การย้ายไปใช้ drive.file (v2)
- ใช้ `drive.file` scope แทน `spreadsheets` ตามคำแนะนำของ Google OAuth verification
- ผู้ใช้ที่เคยล็อกอินด้วย scope เดิม: **ต้องออกจากระบบและเข้าสู่ระบบด้วย Google อีกครั้ง** เพื่อให้ได้รับสิทธิ์ drive.file
- (ถ้าใช้) ตัวเลือก `NEXT_PUBLIC_GOOGLE_API_KEY` ใน env สำหรับ Google Picker (ไม่บังคับ)

---

## หมายเหตุสำคัญ

1. **วันที่ที่เลือก** – ข้อมูล Reach, Spend, Clicks, Engagement, Message และ Video stats ทั้งหมดดึงจาก Facebook Insights **เฉพาะช่วงวันที่ที่เลือก**
2. **เฉพาะรายการที่มีสถิติ** – โฆษณาที่ไม่มีกิจกรรมในช่วงวันที่ที่เลือกจะไม่ถูกส่งออก
3. **บัญชีโฆษณา** – ต้องเลือกบัญชีที่ Settings → Connections → Ad Accounts ก่อน
4. **การเชื่อมต่อ** – ต้องเชื่อมต่อทั้ง Google และ Facebook/Meta ที่ Settings → Connections

---

## ตำแหน่งในเมนู

- **Report Tools** → **Google Sheets Export**
- หรือ [Report Tools → Google Sheets Export](/report-tools/google-sheets-export)
