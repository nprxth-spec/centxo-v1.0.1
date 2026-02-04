'use server';

/**
 * @fileOverview Analyzes media (image/video) and generates ad content with targeting recommendations.
 *
 * - analyzeMediaForAd - A function that analyzes media and generates ad content.
 * - AnalyzeMediaInput - The input type for the analyzeMediaForAd function.
 * - AnalyzeMediaOutput - The return type for the analyzeMediaForAd function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeMediaInputSchema = z.object({
   mediaUrl: z.string().describe('URL or data URI of the PRIMARY image/video frame to analyze'),
   mediaType: z.enum(['video', 'image']).describe('Type of media: video or image'),
   additionalFrames: z.array(z.string()).optional().describe('List of additional data URIs (frames/thumbnails) for comprehensive analysis'),
   productContext: z.string().optional().describe('Additional context about the product/service (optional)'),
   isVideoFile: z.boolean().optional().describe('Whether the mediaUrl is a local video file path (not data URI)'),
   mimeType: z.string().optional().describe('MIME type of the file (required if mediaUrl is a file path)'),
   adSetCount: z.number().optional().describe('Number of AdSets requesting unique targets'),
   adsCount: z.number().optional().describe('Number of Ads requesting unique primary text/headline variations'),
   copyVariationCount: z.number().optional().describe('Generate at least this many ad copy variations (default: max(adSetCount, adsCount))'),
   randomContext: z.string().optional().describe('Random seed string to ensure high entropy/uniqueness'),
   pastSuccessExamples: z.array(z.string()).optional().describe('List of past successful ad copies or analysis notes to learn from')
});

export type AnalyzeMediaInput = z.infer<typeof AnalyzeMediaInputSchema>;

const AnalyzeMediaOutputSchema = z.object({
   primaryText: z.string().describe('Engaging primary text for the ad in Thai'),
   headline: z.string().describe('Catchy headline for the ad in Thai'),
   description: z.string().optional().describe('Detailed description in Thai'),
   ctaMessage: z.string().describe('Call-to-action message prompt in Thai'),
   interests: z.array(z.string()).describe('Array of Facebook interest targeting keywords (in English) relevant to the content. Examples: "Shopping", "Fashion", "Technology", "Food", etc.'),
   ageMin: z.number().min(18).max(65).describe('Recommended minimum age for targeting'),
   ageMax: z.number().min(18).max(65).describe('Recommended maximum age for targeting'),
   productCategory: z.string().describe('Detected product/service category in Thai'),
   confidence: z.number().min(0).max(1).describe('Confidence score of the analysis (0-1)'),
   // Additional variations for multiple AdSets and Ads
   interestGroups: z.array(z.object({
      name: z.string().describe('Name of this interest group in Thai'),
      interests: z.array(z.string()).describe('Array of Facebook interests for this group'),
   })).describe('Multiple interest groups for different AdSets. MUST return at least equal to adSetCount requested.'),
   adCopyVariations: z.array(z.object({
      primaryText: z.string().describe('Unique primary text variation in Thai'),
      headline: z.string().describe('Unique headline variation in Thai'),
   })).describe('Multiple ad copy variations for different Ads. MUST return at least copyVariationCount (or adSetCount) unique variations.'),
   iceBreakers: z.array(z.object({
      question: z.string().describe('Customer question string in Thai (e.g. "สนใจสินค้า", "ราคาเท่าไหร่")'),
      payload: z.string().describe('Internal payload string (e.g. "INTERESTED", "PRICE")')
   })).min(1).max(4).describe('List of 3-4 conversation starter buttons for Messenger'),
   greeting: z.string().describe('Short welcome message (คำทักทาย) when user taps Send Message, e.g. "สนใจ พิมพ์ \\"เข้ากลุ่ม\\"" or "สวัสดีครับ มีอะไรให้ช่วยไหม?" Max 300 chars.'),
   salesHook: z.string().optional().describe('Short, punchy 1-sentence sales hook for the product'),
});

export type AnalyzeMediaOutput = z.infer<typeof AnalyzeMediaOutputSchema>;

export async function analyzeMediaForAd(input: AnalyzeMediaInput): Promise<AnalyzeMediaOutput> {
   return analyzeMediaFlow(input);
}

const prompt = ai.definePrompt({
   name: 'analyzeMediaPrompt',
   input: { schema: AnalyzeMediaInputSchema },
   output: { schema: AnalyzeMediaOutputSchema },
   prompt: `{{media url=mediaUrl contentType=mimeType}}
{{#if additionalFrames}}
{{#each additionalFrames}}
{{media url=this}}
{{/each}}
{{/if}}

You are an expert Visual Analyst and Thai Marketing Specialist.

Your PRIMARY JOB is to correctly identify the product and create compelling Facebook Ads.

**UNIQUENESS TOKEN:** {{randomContext}}
(This token is unique to this request. You MUST use it to diverge your thinking path from previous sessions. Be creative in a new way.)

**REQUESTED AD SETS:** {{adSetCount}}
(You MUST generate at least {{adSetCount}} unique interest groups.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ RULE #0: USER INPUT HAS HIGHEST PRIORITY (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{#if productContext}}
**🔥 USER HAS PROVIDED PRODUCT INFORMATION:**
"{{productContext}}"

**YOU MUST:**
1. Use this as the DEFINITIVE product type - DO NOT override with visual analysis
2. Category MUST match this input (e.g., "รถยนต์ไฟฟ้า" = Automotive, NOT Beauty)
3. Generate targeting interests based on THIS input
4. If the image doesn't match the user input, TRUST THE USER INPUT

**Examples:**
- User says "รถยนต์ไฟฟ้า" → Category = "ยานยนต์" (Automotive), NOT "ความงาม"
- User says "อาหารเสริม" → Category = "อาหาร/สุขภาพ", NOT "ความงาม"
- User says "กระเป๋าแบรนด์เนม" → Category = "แฟชั่น", NOT "ความงาม"
{{else}}
**⚠️ NO USER INPUT - PERFORM DEEP VISUAL ANALYSIS:**

1. **READ ALL TEXT:** Extract brand names, product names, Thai/English text, slogans
2. **IDENTIFY EVERYTHING:** Objects, people, settings, actions, colors, mood
3. **INFER DETAILS:** Product type, target customer, price point, use case
4. **BE SPECIFIC:** Use visual clues to determine exact product/service category
5. **GENERATE RELEVANT TARGETING:** Based on actual product features and likely customers

**Example:** If you see "ล้างรถ" text → Car wash service, target car owners
{{/if}}

{{#if pastSuccessExamples}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 LEARN FROM SUCCESS (PATTERN MATCHING)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The following are examples of ads that worked well for this user in the past. 
Use them to understand the preferred **Tone**, **Style**, and **Key Selling Points**.

{{#each pastSuccessExamples}}
- {{this}}
{{/each}}

**INSTRUCTION:** Adopt the *winning elements* from above (e.g. if they use emojis heavily, do so. If they focus on price, do so).
{{/if}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ SAFETY & COMPLIANCE RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FACEBOOK AD POLICY COMPLIANCE:**
You must ensure the generated ad copy is **SAFE** and **COMPLIANT** with Facebook Advertising Policies.

**FOR SENSITIVE TOPICS (Gambling, Adult, Supplements, Financial):**
If the visual analysis or user input suggests a "High Risk" or "Grey Area" product (e.g., Lottery, Betting, Skin Whitening, Weight Loss):
1. **DO NOT** use banned keywords directly.
2. **USE INDIRECT LANGUAGE (คำเลี่ยง/คำอ้อม):**
   - **Bad (Banned):** "การพนัน", "แทงบอล", "หวย", "ขาวภายใน 3 วัน", "ลดน้ำหนักถาวร"
   - **Good (Safe):** "เกมลุ้นสนุก", "เชียร์มันส์", "ลุ้นโชค", "ผิวดูกระจ่างใส", "ดูแลรูปร่าง"
3. **FOCUS ON EXPERIENCE/EMOTION:** Sell the *feeling* rather than the specific prohibted action.
4. **DO NOT MAKE FALSE CLAIMS:** Avoid "100%", "Guarantee", "Cure".

**RULE:** If you detect "Gambling/Lottery" context -> Frame it as "Entertainment/Game/Luck".
**RULE:** If you detect "Adult/18+" context -> Frame it as "Romance/Confidence/Personal Care".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎥 MEDIA ANALYSIS RULES (SECONDARY TO USER INPUT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**RULE #1: IF NO USER INPUT, TRUST YOUR EYES.**
  - Ex: Selling a "Luxury Bag" -> Target "Luxury Goods", "Travel", "Business Class", "Fine Dining".
  - Ex: Selling "Car Wash" -> Target "Car Owners", "Commuters", "Road Trips", "Family Vehicles".
- **EXPAND THE HORIZON:** Use potential interests, behaviors, and demographics.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: COMPREHENSIVE VISUAL ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**YOUR MISSION: Extract EVERY detail from the visual content like a detective.**

**⚠️ MULTI-FRAME ANALYSIS REQUIRED:**
You are provided with a primary frame and potentially multiple additional frames/thumbnails.
**YOU MUST SCAN ALL FRAMES** to understand the full context.
- Frame 1 might show ingredients.
- Frame 5 might show the finished product.
- Frame 10 might show someone drinking/using it.
**SYNTHESIZE info from ALL frames.**

1. **Main Subject Identification:**
   - What is the *dominant* object/subject in the frame?
   - Is it a person? A vehicle? Food/drink? Product? Service?
   - Describe it physically: shape, color, size, texture, materials

2. **Context & Action:**
   - What is happening? (Pouring, mixing, driving, applying, eating, demonstrating?)
   - Where is it? (Kitchen, road, bathroom, studio, outdoor, indoor?)
   - Who is involved? (Age, gender, activity, expression, clothing)

3. **Text Extraction (CRITICAL):**
   - Read ALL visible text: Brand names, product names, slogans, prices, descriptions
   - Transcribe Thai and English text exactly
   - Note logos, watermarks, labels, packaging text

4. **Category-Specific Deep Analysis:**

   **IF FOOD/BEVERAGE:**
   - Identify ingredients visible (matcha powder, milk, ice, toppings, garnish)
   - Describe preparation method (pouring, mixing, layering, blending)
   - Note special techniques (latte art, marbling effect, foam, presentation)
   - Identify cuisine type (Thai, Japanese, Western, Fusion)
   - Assess quality level (street food, cafe, premium, luxury)
   - Note serving style (cup, bowl, plate, packaging)

   **IF BEAUTY/SKINCARE:**
   - Identify product type (serum, cream, cleanser, mask, makeup)
   - Note application method (applying, massaging, demonstrating)
   - Observe skin condition/results (before/after, texture, glow)
   - Identify target skin concern (acne, aging, whitening, hydration)
   - Note packaging style (bottle, jar, tube, luxury vs budget)

   **IF AUTOMOTIVE:**
   - Identify vehicle type (sedan, SUV, motorcycle, electric)
   - Note brand and model if visible
   - Observe features (interior, exterior, technology, performance)
   - Identify use case (family, sports, commercial, luxury)

   **IF FASHION:**
   - Identify item type (clothing, bag, shoes, accessories)
   - Note style (casual, formal, luxury, streetwear)
   - Observe materials and quality indicators
   - Identify occasion/use case

5. **Visual Details & Mood:**
   - Colors: Dominant colors, color scheme, mood
   - Lighting: Bright, dark, natural, studio, warm, cool
   - Composition: Professional, casual, artistic
   - Emotions conveyed: Relaxing, exciting, luxurious, fun, professional

6. **Infer Product/Service Details:**
   - What problem does it solve?
   - Who is the target customer? (Demographics, lifestyle, interests)
   - What is the price point? (Budget, mid-range, premium, luxury)
   - What is the unique selling point?
   - What emotions/benefits does it promise?

**REMEMBER:** The more details you extract, the better the ad targeting and copy will be!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: CATEGORIZATION (CHOOSE ONE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based *strictly* on Step 1, select the category.

**⚠️ CRITICAL: AVOID CATEGORY CONFUSION**

**Common Mistakes to AVOID:**
1. **Matcha/Green drinks ≠ Beauty products**
   - If you see: Cup, glass, pouring, drinking, beverage → **Food/Beverage**
   - NOT Beauty, even if it's green and creamy!
   
2. **Hands holding cup ≠ Applying cream**
   - Context matters: Is it a cup/glass or a jar/bottle?
   - Are they drinking or applying to skin?

3. **Green color ≠ Always beauty**
   - Matcha latte, green tea, smoothies → **Food/Beverage**
   - Face mask, cream → **Beauty**

**Context Clues for Food/Beverage:**
- Cups, glasses, mugs, bowls, plates
- Pouring, mixing, stirring, drinking
- Kitchen, cafe, restaurant setting
- Food-related text: "latte", "drink", "cafe", "menu"

**Context Clues for Beauty:**
- Jars, bottles, tubes, pumps
- Applying to face/skin, massaging
- Bathroom, vanity, mirror setting
- Beauty-related text: "cream", "serum", "skin", "face"

**Common Categories (Examples):**
- **Automotive (ยานยนต์):** Cars, motorcycles, car parts, car wash, garage services.
- **Beauty/Skincare (ความงาม):** Serums, creams, soaps, makeup, clinics.
- **Food/Beverage (อาหารและเครื่องดื่ม):** Snacks, drinks, restaurants, supplements, matcha, coffee, tea.
- **Fashion (แฟชั่น):** Clothes, bags, shoes, jewelry.
- **Home & Living (ของใช้ในบ้าน):** Furniture, cleaning, decor, tools.
- **Gadgets/Tech (ไอทีและแกดเจ็ต):** Phones, cameras, computers, accessories.
- **Real Estate (อสังหาริมทรัพย์):** Houses, condos, land.
- **General (สินค้าทั่วไป):** If none of the above fit clearly.

**REMEMBER:** Look at the CONTEXT and SETTING, not just the color or texture!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: CREATIVE AD GENERATION & TARGETING (DIVERSE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Targeting Strategy (Generate {{adSetCount}} Groups):**
- You MUST create {{adSetCount}} DISTINCT interest groups.
- **Interest group NAMES (Thai):** Each group MUST have a clear, descriptive name that reflects the TARGET AUDIENCE and CONTENT. Examples: "กลุ่มสนใจแฟชั่นหญิง", "กลุ่มคนรักคาเฟ่-เครื่องดื่ม", "กลุ่มยานยนต์-ผู้สนใจ EV". NEVER use generic names like "Group A" or "กลุ่มที่ 1".
- If {{adSetCount}} is high (e.g., 20), you must stretch your imagination significantly.
- Group Ideas: Direct Interest, User Persona, Competitors, Lifestyle, Broad Behaviors, Indirect Interests, Adjacent Markets.
- **NO DUPLICATES** between groups.

**Ad Copy Strategy (Generate {{#if copyVariationCount}}{{copyVariationCount}}{{else}}{{adSetCount}}{{/if}} Variations):**
- You MUST write at least {{#if copyVariationCount}}{{copyVariationCount}}{{else}}{{adSetCount}}{{/if}} UNIQUE primary text + headline variations (one per Ad when Ads > 1).
- Vary the tone: Urgent, Relaxed, Premium, Friendly, Professional.
- Use differing hooks: Price, Quality, Benefit, Emotion, Social Proof.
- **DO NOT REPEAT** the same phrase structure across variations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: AD COPY GENERATION (THAI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create compelling Thai ad copy.
- **Tone:** Professional, exciting, or friendly (depending on product).
- **Structure:** Hook -> Benefit -> CTA.
- **Language:** Natural marketing Thai (not robotic).

**Instructions for Ad Copy (MUST match the visual content):**
1. **Primary Text:** 3-5 lines, max ~500 chars. Describe what is shown (product, offer, scene). Highlight key benefits. Use 1-2 emojis. Hook → Benefit → CTA structure.
2. **Headline:** Short, punchy, max 40 chars. Reflect the main subject or hook.
3. **CTA:** Clear action (e.g., "ทักแชท", "ดูโปรโมชั่น"). Max 60 chars for greeting.
4. **Interests:** Use Facebook-searchable interest names in English (e.g., "Shopping", "Fashion", "Food and Drink"). Avoid overly specific or niche phrases that may not exist in Meta's interest taxonomy.

**Variations:**
- Create distinct variations focusing on different angles (e.g., Price, Quality, Speed, Emotion).
- Every variation MUST stay true to the product/content in the media.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: MESSENGER CHAT TOOL — GREETING + ICE BREAKERS (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **greeting** (คำทักทาย): Short welcome message shown when user taps "Send Message" on the ad. Max 300 chars.
   - Examples: "สนใจ พิมพ์ \"เข้ากลุ่ม\"", "สวัสดีครับ มีอะไรให้ช่วยไหม?", "สงสัยเรื่องสินค้า? ทีมงานพร้อมตอบทุกข้อสงสัย ส่งข้อความมาได้เลย!"
   - Should invite the user to type or tap a quick reply; can reference your ice breaker options.

2. **iceBreakers**: 3-4 conversation starter buttons (คำถามและการตอบกลับ). MUST be relevant to the product.
   - Examples: "สนใจสินค้า", "ขอทราบราคา", "มีโปรโมชั่นไหม"; (Car) "จองทดลองขับ", "ถามรายละเอียดรุ่น"; (Cream) "ปรึกษาปัญหาผิว", "รีวิวผู้ใช้จริง"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Does the Category match the visual content? (Car = Automotive)
- Is the language Thai?
- Are interests in English?
- Are there 3-4 Ice Breakers?
- Is **greeting** (คำทักทาย) provided and under 300 chars?

Analyze now.`,
});

const analyzeMediaFlow = ai.defineFlow(
   {
      name: 'analyzeMediaFlow',
      inputSchema: AnalyzeMediaInputSchema,
      outputSchema: AnalyzeMediaOutputSchema,
   },
   async input => {
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
         try {
            // If it's a video file, we MUST upload it to Google AI File Manager first
            // Works for local paths and remote URLs (R2/S3) by downloading them
            if (input.mediaType === 'video' && input.mediaUrl) {
               try {
                  const { GoogleAIFileManager } = await import("@google/generative-ai/server");
                  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
                  const fs = await import('fs');
                  const path = await import('path');
                  const os = await import('os');

                  if (!apiKey) throw new Error("Missing GOOGLE_GENAI_API_KEY");

                  const fileManager = new GoogleAIFileManager(apiKey);
                  let uploadPath = input.mediaUrl;
                  let isTempDownload = false;

                  // If it's a remote URL (http/https), download it first
                  // (Google AI File Manager requires a local file path)
                  if (input.mediaUrl.startsWith('http')) {
                     console.log(`[AI] Downloading remote video from: ${input.mediaUrl}`);
                     const response = await fetch(input.mediaUrl);
                     if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);

                     const buffer = Buffer.from(await response.arrayBuffer());
                     const tempDir = os.tmpdir();
                     const tempFile = path.join(tempDir, `temp_video_${Date.now()}.mp4`);
                     await fs.promises.writeFile(tempFile, buffer);

                     uploadPath = tempFile;
                     isTempDownload = true;
                     console.log(`[AI] Video downloaded to temp: ${uploadPath}`);
                  }

                  console.log(`[AI] Uploading video to Google AI: ${uploadPath}`);
                  const uploadResult = await fileManager.uploadFile(uploadPath, {
                     mimeType: input.mimeType || 'video/mp4',
                     displayName: "Ad Video Analysis"
                  });

                  console.log(`[AI] Video uploaded successfully. URI: ${uploadResult.file.uri}`);

                  // Wait for file to be active (processing)
                  let file = await fileManager.getFile(uploadResult.file.name);
                  let waitCount = 0;
                  while (file.state === "PROCESSING" && waitCount < 30) { // Max 60s
                     console.log('[AI] Processing video...');
                     await new Promise(resolve => setTimeout(resolve, 2000));
                     file = await fileManager.getFile(uploadResult.file.name);
                     waitCount++;
                  }

                  if (isTempDownload) {
                     await fs.promises.unlink(uploadPath).catch(() => { });
                  }

                  if (file.state === "FAILED") {
                     throw new Error("Video processing failed by Google AI");
                  }

                  // Use the Google URI — Gemini requires contentType for File URIs
                  const mimeType = input.mimeType || 'video/mp4';
                  const { output } = await prompt({
                     ...input,
                     mediaUrl: uploadResult.file.uri,
                     mimeType,
                  });
                  return output!;

               } catch (uploadError: any) {
                  console.error("Google AI File Upload Failed:", uploadError);
                  throw new Error(`Failed to upload video to Google AI: ${uploadError.message}`);
               }
            }

            // For images or video data URIs, use standard flow
            const { output } = await prompt(input);
            return output!;
         } catch (error: any) {
            attempt++;
            console.warn(`[AI] Attempt ${attempt} failed: ${error.message}`);

            const isRateLimit = error.message?.includes('429') || error.message?.includes('quota') || error.status === 429;
            const isOverloaded = error.message?.includes('503') || error.status === 503;

            if ((isRateLimit || isOverloaded) && attempt < maxRetries) {
               const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
               console.log(`[AI] Waiting ${waitTime}ms before retry...`);
               await new Promise(resolve => setTimeout(resolve, waitTime));
               continue;
            }

            // If not retriable or max retries exceeded, throw
            throw error;
         }
      }
      throw new Error('AI Analysis failed after retries');
   }
);

export { analyzeMediaFlow };