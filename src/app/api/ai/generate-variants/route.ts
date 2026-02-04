import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const genAI = process.env.GOOGLE_GENAI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY)
  : null;

const SYSTEM_PROMPT = `You are an expert Facebook Ads copywriter. Generate multiple A/B test variants of ad copy.

Rules:
- Primary text: max 125 characters, compelling, encourages message or action.
- Headline: max 40 characters, punchy and clear.
- Each variant must be meaningfully different (angle, tone, CTA, emotional hook).
- Use Thai and/or English as appropriate for the target market; mix if requested.
- No markdown, no code blocks. Return only valid JSON.`;

type Variant = { primaryText: string; headline: string };

function fallbackVariants(count: number, ctx: string): Variant[] {
  const t = ctx || 'สินค้า';
  const base: Variant[] = [
    { primaryText: `🎁 โปรโมชั่นพิเศษ ${t}! ส่งข้อความมาสอบถามเลย วันนี้รับส่วนลด`, headline: `สอบถาม ${t} รับส่วนลด` },
    { primaryText: `💬 สงสัยเรื่อง ${t}? ทีมพร้อมตอบทุกคำถาม ส่งข้อความมาได้เลย`, headline: 'สอบถามได้ 24/7' },
    { primaryText: `⚡ ${t} ราคาพิเศษ ส่งข้อความวันนี้ รับสิทธิก่อนใคร`, headline: 'รีบด่วน! เหลือจำกัด' },
    { primaryText: `✨ ค้นพบ ${t} ที่คุณตามหา สอบถามรายละเอียดผ่าน Messenger`, headline: 'สอบถามฟรี ไม่มีค่าใช้จ่าย' },
  ];
  return base.slice(0, Math.min(count, base.length));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitResponse = await rateLimit(request, RateLimitPresets.aiAnalysis, session.user.id);
  if (rateLimitResponse) return rateLimitResponse;

  let body: { primaryText?: string; headline?: string; productContext?: string; count?: number } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const primaryText = typeof body.primaryText === 'string' ? body.primaryText.trim() : '';
  const headline = typeof body.headline === 'string' ? body.headline.trim() : '';
  const productContext = typeof body.productContext === 'string' ? body.productContext.trim() : '';
  const count = Math.min(6, Math.max(2, Number(body.count) || 4));

  const hasInput = primaryText.length > 0 || headline.length > 0 || productContext.length > 0;
  if (!hasInput) {
    return NextResponse.json(
      { error: 'Provide at least one of: primaryText, headline, productContext' },
      { status: 400 }
    );
  }

  if (!genAI) {
    const ctx = productContext || primaryText || headline || 'สินค้า';
    return NextResponse.json({ variants: fallbackVariants(count, ctx) });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const userPrompt = `Generate exactly ${count} distinct A/B test variants of Facebook ad copy.

${primaryText ? `Reference primary text (vary this): ${primaryText}` : ''}
${headline ? `Reference headline (vary this): ${headline}` : ''}
${productContext ? `Product/context: ${productContext}` : ''}

Return a JSON array only, no other text. Each object: { "primaryText": "...", "headline": "..." }
- primaryText max 125 chars, headline max 40 chars.
- Each variant must differ in angle, tone, or CTA.`;

    const result = await model.generateContent([SYSTEM_PROMPT, userPrompt]);
    const text = result.response.text();
    const clean = text.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start === -1 || end === -1) {
      throw new Error('Invalid JSON array in model response');
    }
    const parsed = JSON.parse(clean.slice(start, end + 1)) as Variant[];
    const variants = parsed
      .filter((v) => v && typeof v.primaryText === 'string' && typeof v.headline === 'string')
      .slice(0, count)
      .map((v) => ({
        primaryText: String(v.primaryText).slice(0, 125),
        headline: String(v.headline).slice(0, 40),
      }));

    if (variants.length === 0) {
      throw new Error('No valid variants parsed');
    }
    return NextResponse.json({ variants });
  } catch (e) {
    console.error('[generate-variants] AI error:', e);
    const ctx = productContext || primaryText || headline || 'สินค้า';
    return NextResponse.json({ variants: fallbackVariants(count, ctx) });
  }
}
