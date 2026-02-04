# AI Prompt Templates for Ad Copy Generation

## System Prompt (Used for all ad copy generation)

```
You are an expert Facebook Ads copywriter specializing in Messages ads for the Thai market.

Your task is to generate high-converting ad copy that encourages users to send a message to the business.

Guidelines:
1. Primary Text: 125 characters max, compelling and action-oriented
2. Headline: 40 characters max (optional but recommended)
3. CTA Message Prompt: Short greeting that appears when user clicks (60 chars max)
4. Always provide both Thai (TH) and English (EN) versions
5. Thai copy should feel natural, not translated
6. Focus on benefits and urgency
7. Use emojis sparingly but effectively (1-2 per copy)
8. Encourage immediate action through messaging
9. Test different psychological triggers: urgency, scarcity, social proof, curiosity
10. Maintain friendly, approachable tone

Response format (JSON):
{
  "copies": [
    {
      "primaryTextTH": "Thai primary text here (max 125 chars)",
      "primaryTextEN": "English primary text here (max 125 chars)",
      "headlineTH": "Thai headline (max 40 chars)",
      "headlineEN": "English headline (max 40 chars)",
      "ctaMessagePromptTH": "สวัสดีค่ะ สนใจสินค้าใช่ไหมคะ (max 60 chars)",
      "ctaMessagePromptEN": "Hi! Interested in our product? (max 60 chars)"
    }
  ]
}
```

---

## User Prompt Template 1: Generate Multiple Variations

```
Generate {numberOfVariations} different ad copy variations for a Facebook Messages ad campaign.

Product/Service Context: {productContext}
Tone: {tone}
Target Market: Thailand (Thai and English speakers)
Objective: Get users to send a message to the business page

Create diverse variations that:
- Test different angles (benefit-focused, urgency, social proof, curiosity, problem-solution)
- Use different emotional triggers
- Vary the messaging approach
- All encourage users to send a message

Important constraints:
- Primary text must be under 125 characters
- Headline must be under 40 characters
- CTA message prompt must be under 60 characters
- Include both Thai and English versions for each element
- Thai versions should sound natural, not machine-translated

Return exactly {numberOfVariations} unique variations in JSON format.
```

### Example Usage:

**Input:**
```javascript
{
  "numberOfVariations": 5,
  "productContext": "Online fitness coaching program with personalized meal plans and workout routines. 30-day money-back guarantee. Perfect for busy professionals.",
  "tone": "friendly"
}
```

**Expected Output:**
```json
{
  "copies": [
    {
      "primaryTextTH": "💪 โปรแกรมออกกำลังกายส่วนบุคคล พร้อมแผนอาหาร รับประกัน 30 วัน! สอบถามฟรี",
      "primaryTextEN": "💪 Personalized fitness program with meal plans. 30-day guarantee! Ask for free",
      "headlineTH": "เริ่มต้นวันนี้ ฟรี!",
      "headlineEN": "Start Today Free!",
      "ctaMessagePromptTH": "สวัสดีค่ะ สนใจโปรแกรมฟิตเนสใช่ไหมคะ",
      "ctaMessagePromptEN": "Hi! Interested in our fitness program?"
    },
    {
      "primaryTextTH": "⏰ คนทำงานยุ่ง? เราออกแบบโปรแกรมให้เหมาะกับคุณ ส่งข้อความมาคุยกันเลย!",
      "primaryTextEN": "⏰ Busy professional? We design programs for you. Message us now!",
      "headlineTH": "เพียง 30 นาทีต่อวัน",
      "headlineEN": "Just 30 Minutes Daily",
      "ctaMessagePromptTH": "สวัสดีครับ อยากปรึกษาโปรแกรมครับ",
      "ctaMessagePromptEN": "Hello! I'd like to consult about the program"
    },
    {
      "primaryTextTH": "🔥 ลดน้ำหนักได้จริง! แผนส่วนตัวจากโค้ชมืออาชีพ รับประกันผล หรือคืนเงิน 100%",
      "primaryTextEN": "🔥 Real weight loss results! Personal plan from pro coach. Money-back guarantee",
      "headlineTH": "รับประกัน 30 วัน",
      "headlineEN": "30-Day Guarantee",
      "ctaMessagePromptTH": "สวัสดีค่ะ อยากทราบรายละเอียดเพิ่มเติมคะ",
      "ctaMessagePromptEN": "Hi! I'd like to know more details"
    },
    {
      "primaryTextTH": "✨ เปลี่ยนร่างกายใน 90 วัน พร้อมแผนอาหารและคำแนะนำตลอดเวลา ลองฟรี 7 วัน!",
      "primaryTextEN": "✨ Transform in 90 days with meal plans & 24/7 support. 7-day free trial!",
      "headlineTH": "ทดลองฟรี 7 วัน",
      "headlineEN": "7-Day Free Trial",
      "ctaMessagePromptTH": "สวัสดีค่ะ สนใจทดลองฟรีคะ",
      "ctaMessagePromptEN": "Hi! Interested in the free trial"
    },
    {
      "primaryTextTH": "🎯 ผลลัพธ์จริงจากลูกค้ากว่า 1,000 คน! โปรแกรมออกกำลังกายที่ใช่สำหรับคุณ",
      "primaryTextEN": "🎯 Real results from 1,000+ clients! The right fitness program for you",
      "headlineTH": "ลูกค้ายืนยัน 1,000+",
      "headlineEN": "1,000+ Happy Clients",
      "ctaMessagePromptTH": "สวัสดีครับ อยากดูตัวอย่างผลลัพธ์ครับ",
      "ctaMessagePromptEN": "Hello! I'd like to see success stories"
    }
  ]
}
```

---

## User Prompt Template 2: Generate Optimized Copy from Winners

```
Based on these winning ad copies that performed well:

{winnerCopiesJSON}

Context: {productContext}

Generate 1 new optimized ad copy that combines the best elements from these winners.

The new copy should:
1. Keep the winning patterns and angles that worked
2. Introduce fresh wording to avoid ad fatigue
3. Maintain the successful tone and structure
4. Be even more compelling than the winners
5. Test a slightly different psychological angle

Analysis:
- What made these copies successful?
- Which emotional triggers resonated?
- What messaging patterns appeared?

Use these insights to create an improved version.

Important constraints:
- Primary text must be under 125 characters
- Headline must be under 40 characters
- CTA message prompt must be under 60 characters
- Include both Thai and English versions

Return 1 optimized copy in JSON format.
```

### Example Usage:

**Input:**
```javascript
{
  "winnerCopies": [
    {
      "primaryTextTH": "💪 โปรแกรมออกกำลังกายส่วนบุคคล พร้อมแผนอาหาร รับประกัน 30 วัน! สอบถามฟรี",
      "primaryTextEN": "💪 Personalized fitness program with meal plans. 30-day guarantee!",
      "metrics": {
        "messages": 8,
        "costPerMessage": 1.25
      }
    },
    {
      "primaryTextTH": "🔥 ลดน้ำหนักได้จริง! แผนส่วนตัวจากโค้ชมืออาชีพ รับประกันผล หรือคืนเงิน 100%",
      "primaryTextEN": "🔥 Real weight loss! Personal plan from pro coach. Money-back guarantee",
      "metrics": {
        "messages": 12,
        "costPerMessage": 1.15
      }
    }
  ],
  "productContext": "Online fitness coaching program"
}
```

**Expected Output:**
```json
{
  "copies": [
    {
      "primaryTextTH": "💪 ลดน้ำหนักจริงจัง! โค้ชมืออาชีพ+แผนอาหารส่วนตัว รับประกันผล 30 วัน ลองฟรี!",
      "primaryTextEN": "💪 Serious weight loss! Pro coach+personal meal plan. 30-day guarantee. Try free!",
      "headlineTH": "รับประกันผล 100%",
      "headlineEN": "100% Results Guaranteed",
      "ctaMessagePromptTH": "สวัสดีค่ะ อยากเริ่มเปลี่ยนแปลงตัวเองคะ",
      "ctaMessagePromptEN": "Hi! Ready to transform myself"
    }
  ]
}
```

---

## User Prompt Template 3: Industry-Specific Variations

### For E-commerce Products:

```
Generate {numberOfVariations} ad copy variations for a Facebook Messages campaign.

Product Type: E-commerce
Product Details: {productDetails}
Unique Selling Points: {usps}
Special Offer: {offer}
Target Audience: Thai consumers (ages 20-45)

Create variations that emphasize:
- Product benefits and features
- Special offers or discounts
- Social proof (if available)
- Urgency (limited stock, time-limited offer)
- Easy shopping experience via messenger

Style: Enthusiastic, modern, trustworthy
Tone: Friendly and conversational

Return {numberOfVariations} variations in JSON format.
```

### For Service-Based Businesses:

```
Generate {numberOfVariations} ad copy variations for a Facebook Messages campaign.

Service Type: {serviceType}
Service Description: {serviceDescription}
Problem Solved: {problemSolved}
Benefits: {benefits}
Target Audience: {targetAudience}

Create variations that:
- Highlight the problem your service solves
- Emphasize expertise and credibility
- Make it easy to inquire via message
- Reduce friction (free consultation, no commitment, etc.)
- Build trust

Style: Professional yet approachable
Tone: {tone}

Return {numberOfVariations} variations in JSON format.
```

### For Lead Generation:

```
Generate {numberOfVariations} ad copy variations for a Facebook Messages campaign.

Campaign Goal: Lead Generation
Offer: {offer} (e.g., "Free consultation", "Free trial", "Download guide")
Industry: {industry}
Target Pain Points: {painPoints}
Target Audience: {targetAudience}

Create variations that:
- Lead with the free offer
- Address specific pain points
- Make the action simple (just message us)
- Qualify leads gently
- Promise quick response

Style: Helpful, solution-oriented
Tone: {tone}

Return {numberOfVariations} variations in JSON format.
```

---

## Tone Variations

### Professional Tone
```
Tone: Professional and trustworthy
Style: Use industry terms, focus on expertise, credentials, and proven results
Example: "มืออาชีพระดับสากล | International certified professionals"
```

### Casual/Friendly Tone
```
Tone: Casual and friendly
Style: Conversational, use everyday language, include enthusiasm
Example: "มาคุยกันได้นะ ไม่ต้องเกรงใจ! | Let's chat, no pressure!"
```

### Urgent Tone
```
Tone: Urgent and action-oriented
Style: Time-sensitive language, FOMO triggers, limited availability
Example: "เหลือเพียง 3 วัน! | Only 3 days left!"
```

### Luxurious Tone
```
Tone: Premium and exclusive
Style: Sophisticated language, emphasize quality and exclusivity
Example: "เพียงสำหรับผู้ที่เห็นคุณค่า | For those who appreciate quality"
```

---

## A/B Testing Angles

### Angle 1: Benefit-Focused
```
Focus: What the customer gets
Example TH: "ผิวสวยใส ภายใน 7 วัน รับประกันผล!"
Example EN: "Beautiful clear skin in 7 days, guaranteed!"
```

### Angle 2: Problem-Solution
```
Focus: Identify problem, offer solution
Example TH: "ผมร่วง? เรามีวิธีแก้ปัญหาที่เหมาะกับคุณ"
Example EN: "Hair loss? We have the perfect solution for you"
```

### Angle 3: Social Proof
```
Focus: Others' success, testimonials
Example TH: "ลูกค้า 5,000+ คนวางใจเรา มาเป็นคนต่อไป!"
Example EN: "5,000+ happy customers trust us. Be next!"
```

### Angle 4: Urgency/Scarcity
```
Focus: Limited time, limited stock
Example TH: "โปรพิเศษวันนี้เท่านั้น! เหลือ 10 ที่"
Example EN: "Today only! Last 10 spots available"
```

### Angle 5: Curiosity/Intrigue
```
Focus: Ask questions, create mystery
Example TH: "คุณรู้หรือไม่ว่า 90% คนทำผิดวิธีนี้?"
Example EN: "Did you know 90% do this wrong?"
```

### Angle 6: Authority/Expertise
```
Focus: Credentials, experience, awards
Example TH: "ผู้เชี่ยวชาญด้วยประสบการณ์ 15 ปี"
Example EN: "Expert with 15 years of experience"
```

---

## Validation Rules

After generating copies, always validate:

```typescript
function validateAdCopy(copy) {
  const errors = [];
  
  // Check Thai primary text length
  if (copy.primaryTextTH.length > 125) {
    errors.push(`Thai primary text too long: ${copy.primaryTextTH.length} chars`);
  }
  
  // Check English primary text length
  if (copy.primaryTextEN.length > 125) {
    errors.push(`English primary text too long: ${copy.primaryTextEN.length} chars`);
  }
  
  // Check Thai headline length (if exists)
  if (copy.headlineTH && copy.headlineTH.length > 40) {
    errors.push(`Thai headline too long: ${copy.headlineTH.length} chars`);
  }
  
  // Check English headline length (if exists)
  if (copy.headlineEN && copy.headlineEN.length > 40) {
    errors.push(`English headline too long: ${copy.headlineEN.length} chars`);
  }
  
  // Check CTA prompt length
  if (copy.ctaMessagePromptTH.length > 60) {
    errors.push(`Thai CTA too long: ${copy.ctaMessagePromptTH.length} chars`);
  }
  
  if (copy.ctaMessagePromptEN.length > 60) {
    errors.push(`English CTA too long: ${copy.ctaMessagePromptEN.length} chars`);
  }
  
  // Check for required fields
  if (!copy.primaryTextTH || !copy.primaryTextEN) {
    errors.push('Missing required primary text');
  }
  
  if (!copy.ctaMessagePromptTH || !copy.ctaMessagePromptEN) {
    errors.push('Missing required CTA message prompt');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Fallback Templates

If AI generation fails, use these proven templates:

```typescript
const FALLBACK_TEMPLATES = [
  {
    primaryTextTH: "🎁 โปรโมชั่นพิเศษ! ส่งข้อความมาสอบถามเลยวันนี้ รับส่วนลดทันที",
    primaryTextEN: "🎁 Special Promotion! Message us today for instant discount",
    headlineTH: "สอบถามเลย รับส่วนลด",
    headlineEN: "Ask Now Get Discount",
    ctaMessagePromptTH: "สวัสดีค่ะ สนใจโปรโมชั่นใช่ไหมคะ",
    ctaMessagePromptEN: "Hi! Interested in our promo?"
  },
  {
    primaryTextTH: "💬 มีคำถาม? ทีมงานพร้อมตอบทุกข้อสงสัย ส่งข้อความมาได้เลย!",
    primaryTextEN: "💬 Questions? Our team is ready to help. Send us a message!",
    headlineTH: "สอบถามได้ตลอด 24/7",
    headlineEN: "Ask Anytime 24/7",
    ctaMessagePromptTH: "สวัสดีครับ มีอะไรให้ช่วยไหมครับ",
    ctaMessagePromptEN: "Hello! How can we help?"
  },
  {
    primaryTextTH: "⚡ จำกัดเวลา! ส่งข้อความเลยวันนี้ รับสิทธิพิเศษก่อนใคร",
    primaryTextEN: "⚡ Limited Time! Message today for exclusive benefits",
    headlineTH: "รีบด่วน! เหลือไม่กี่ที่",
    headlineEN: "Hurry! Limited Slots",
    ctaMessagePromptTH: "สวัสดีค่ะ รับสิทธิพิเศษเลยคะ",
    ctaMessagePromptEN: "Hi! Get your special offer"
  }
];
```

---

## Best Practices Summary

✅ **DO:**
- Use emojis strategically (1-2 per copy)
- Focus on benefits, not features
- Include clear call-to-action
- Test different psychological triggers
- Keep Thai versions culturally appropriate
- Make messaging feel effortless

❌ **DON'T:**
- Use too many emojis (looks spammy)
- Make false claims
- Use complex language
- Forget to include both languages
- Exceed character limits
- Sound too salesy

---

## Performance Optimization

Monitor which prompt variations produce best results:

```typescript
// Track prompt effectiveness
{
  promptType: "benefit-focused",
  avgMessagesPerAd: 5.2,
  avgCostPerMessage: 1.15,
  successRate: 0.75
}

// Adjust future prompts based on data
if (successRate > 0.7) {
  // Use this prompt style more often
}
```

---

This comprehensive prompt library ensures consistent, high-quality ad copy generation for your Facebook Messages campaigns!
