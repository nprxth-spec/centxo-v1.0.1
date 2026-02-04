/**
 * AI Copy Generation Service
 * Uses Google Gemini to generate ad copy variations for Thai and English
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const apiKey = process.env.GOOGLE_GENAI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

interface AdCopyRequest {
  productContext?: string;
  tone?: 'professional' | 'casual' | 'urgent' | 'friendly';
  numberOfVariations: number;
}

interface AdCopy {
  primaryTextTH: string;
  primaryTextEN: string;
  headlineTH?: string;
  headlineEN?: string;
  ctaMessagePromptTH: string;
  ctaMessagePromptEN: string;
}

const SYSTEM_PROMPT = `You are an expert Facebook Ads copywriter specializing in Messages ads for the Thai market.

Your task is to generate high-converting ad copy that encourages users to send a message to the business.

Guidelines:
1. Primary Text: 125 characters max, compelling and action-oriented
2. Headline: 40 characters max (optional but recommended)
3. CTA Message Prompt: Short greeting that appears when user clicks (20 chars max)
4. Always provide both Thai (TH) and English (EN) versions
5. Thai copy should feel natural, not translated
6. Focus on benefits and urgency
7. Use emojis sparingly but effectively
8. Encourage immediate action through messaging

Response format (JSON Array):
[
  {
    "primaryTextTH": "Thai primary text here",
    "primaryTextEN": "English primary text here",
    "headlineTH": "Thai headline",
    "headlineEN": "English headline",
    "ctaMessagePromptTH": "สวัสดีค่ะ สนใจสินค้าใช่ไหมคะ",
    "ctaMessagePromptEN": "Hi! Interested in our product?"
  }
]`;

/**
 * Generate multiple ad copy variations using AI
 */
export async function generateAdCopies(request: AdCopyRequest): Promise<AdCopy[]> {
  const { productContext = 'general product', tone = 'friendly', numberOfVariations } = request;

  if (!genAI) {
    console.warn('⚠️ GOOGLE_GENAI_API_KEY not found. Using fallback copies.');
    return generateFallbackCopies(numberOfVariations);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const userPrompt = `Generate ${numberOfVariations} different ad copy variations for a Facebook Messages ad campaign.

Product/Service Context: ${productContext}
Tone: ${tone}
Target Market: Thailand (Thai and English speakers)

Create diverse variations that:
- Test different angles (benefit-focused, urgency, social proof, curiosity)
- Use different emotional triggers
- Vary the messaging approach
- All encourage users to send a message

Return exactly ${numberOfVariations} unique variations in valid JSON format (Array of objects). Do not include markdown code blocks.`;

    const result = await model.generateContent([SYSTEM_PROMPT, userPrompt]);
    const response = result.response;
    const text = response.text();

    // Clean up markdown if present
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const start = cleanJson.indexOf('[');
    const end = cleanJson.lastIndexOf(']');

    if (start === -1 || end === -1) {
      throw new Error('Invalid JSON response from AI');
    }

    const jsonStr = cleanJson.substring(start, end + 1);
    const copies = JSON.parse(jsonStr) as AdCopy[];

    // Validate and limit count
    return copies.slice(0, numberOfVariations);

  } catch (error) {
    console.error('❌ AI Generation Failed:', error);
    return generateFallbackCopies(numberOfVariations);
  }
}

/**
 * Fallback copies if AI fails
 */
/**
 * Fallback copies if AI fails - NOW WITH DYNAMIC CONTEXT
 */
function generateFallbackCopies(count: number, context: string = ''): AdCopy[] {
  // Simple extraction of a "product name" or key term from context if possible
  // E.g. "Selling organic dog food" -> "Organic Dog Food"
  // This is a naive heuristic but better than nothing.
  const cleanContext = context.replace(/Selling|Promotion|Ad for/gi, '').trim();
  const productTerm = cleanContext.length > 0 && cleanContext.length < 30 ? cleanContext : 'สินค้า';
  const productTermEN = cleanContext.length > 0 && cleanContext.length < 30 ? cleanContext : 'Product';

  const templates: AdCopy[] = [
    {
      primaryTextTH: `🎁 โปรโมชั่นพิเศษสำหรับ ${productTerm}! ส่งข้อความมาสอบถามเลยวันนี้ รับส่วนลดทันที`,
      primaryTextEN: `🎁 Special Promotion for ${productTermEN}! Message us today for instant discount`,
      headlineTH: `สอบถาม ${productTerm} รับส่วนลด`,
      headlineEN: `Ask about ${productTermEN}`,
      ctaMessagePromptTH: 'สวัสดีค่ะ สนใจโปรโมชั่นใช่ไหมคะ',
      ctaMessagePromptEN: 'Hi! Interested in our promo?',
    },
    {
      primaryTextTH: `💬 สงสัยเรื่อง ${productTerm}? ทีมงานพร้อมตอบทุกข้อสงสัย ส่งข้อความมาได้เลย!`,
      primaryTextEN: `💬 Questions about ${productTermEN}? Our team is ready to help. Send us a message!`,
      headlineTH: 'สอบถามได้ตลอด 24/7',
      headlineEN: 'Ask Anytime 24/7',
      ctaMessagePromptTH: `สวัสดีครับ สนใจ ${productTerm} ครับ`,
      ctaMessagePromptEN: `Hello! Interested in ${productTermEN}`,
    },
    {
      primaryTextTH: `⚡ ${productTerm} ราคาพิเศษ! ส่งข้อความเลยวันนี้ รับสิทธิก่อนใคร`,
      primaryTextEN: `⚡ ${productTermEN} Special Price! Message today for exclusive benefits`,
      headlineTH: 'รีบด่วน! เหลือไม่กี่ที่',
      headlineEN: 'Hurry! Limited Stock',
      ctaMessagePromptTH: 'สวัสดีค่ะ รับสิทธิพิเศษเลยคะ',
      ctaMessagePromptEN: 'Hi! Get your special offer',
    },
    {
      primaryTextTH: `✨ ค้นพบ ${productTerm} ที่คุณตามหา! สอบถามรายละเอียดเพิ่มเติมได้ทาง Messenger`,
      primaryTextEN: `✨ Discover the ${productTermEN} you need! Ask for details via Messenger`,
      headlineTH: 'สอบถามฟรี ไม่มีค่าใช้จ่าย',
      headlineEN: 'Free Inquiry No Cost',
      ctaMessagePromptTH: 'สวัสดีค่ะ อยากทราบรายละเอียดคะ',
      ctaMessagePromptEN: 'Hi! Want to know more',
    },
    {
      primaryTextTH: `🔥 ${productTerm} ของดีมีจำนวนจำกัด ส่งข้อความมาจองก่อนของหมด!`,
      primaryTextEN: `🔥 ${productTermEN} Limited stock! Message to reserve before sold out!`,
      headlineTH: 'จองเลย ก่อนหมด!',
      headlineEN: 'Reserve Now!',
      ctaMessagePromptTH: 'สวัสดีค่ะ อยากจองเลยคะ',
      ctaMessagePromptEN: 'Hi! I want to reserve',
    },
  ];

  return templates.slice(0, Math.min(count, templates.length));
}

/**
 * Generate a single optimized copy based on winning patterns
 */
export async function generateOptimizedCopy(
  winnerCopies: AdCopy[],
  context: string
): Promise<AdCopy> {
  if (!genAI) {
    return generateFallbackCopies(1)[0];
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const userPrompt = `Based on these winning ad copies that performed well:

${JSON.stringify(winnerCopies, null, 2)}

Generate 1 new optimized ad copy that combines the best elements from these winners.
Context: ${context}

The new copy should:
1. Keep the winning patterns and angles
2. Introduce fresh wording to avoid ad fatigue
3. Maintain the successful tone and structure
4. Be even more compelling

Return 1 copy in valid JSON format (Object). Do not include markdown code blocks.`;

    const result = await model.generateContent([SYSTEM_PROMPT, userPrompt]);
    const response = result.response;
    const text = response.text();

    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Find first { and last }
    const start = cleanJson.indexOf('{');
    const end = cleanJson.lastIndexOf('}');

    if (start === -1 || end === -1) {
      throw new Error('Invalid JSON response');
    }

    const jsonStr = cleanJson.substring(start, end + 1);
    return JSON.parse(jsonStr) as AdCopy;

  } catch (error) {
    console.error('❌ AI Optimization Failed:', error);
    return generateFallbackCopies(1)[0];
  }
}

/**
 * Validate ad copy constraints
 */
export function validateAdCopy(copy: AdCopy): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check primary text length (max 125 chars)
  if (copy.primaryTextTH.length > 125) {
    errors.push('Thai primary text exceeds 125 characters');
  }
  if (copy.primaryTextEN.length > 125) {
    errors.push('English primary text exceeds 125 characters');
  }

  // Check headline length (max 40 chars)
  if (copy.headlineTH && copy.headlineTH.length > 40) {
    errors.push('Thai headline exceeds 40 characters');
  }
  if (copy.headlineEN && copy.headlineEN.length > 40) {
    errors.push('English headline exceeds 40 characters');
  }

  // Check CTA message prompt length (max 20 chars)
  if (copy.ctaMessagePromptTH.length > 60) {
    errors.push('Thai CTA message prompt exceeds 60 characters');
  }
  if (copy.ctaMessagePromptEN.length > 60) {
    errors.push('English CTA message prompt exceeds 60 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  generateAdCopies,
  generateOptimizedCopy,
  validateAdCopy,
};
