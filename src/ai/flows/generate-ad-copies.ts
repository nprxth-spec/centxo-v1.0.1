'use server';

/**
 * @fileOverview Generates multiple ad copy variations in Thai and English for Facebook Message Ads.
 *
 * - generateAdCopies - A function that generates ad copies.
 * - GenerateAdCopiesInput - The input type for the generateAdCopies function.
 * - GenerateAdCopiesOutput - The return type for the generateAdCopies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAdCopiesInputSchema = z.object({
  videoDescription: z
    .string()
    .describe('Description of the video to be used in the ad.'),
  numberOfAds: z.number().describe('The number of ad copies to generate.'),
});

export type GenerateAdCopiesInput = z.infer<typeof GenerateAdCopiesInputSchema>;

const AdCopySchema = z.object({
  primaryTextTH: z.string().describe('Ad primary text in Thai.'),
  primaryTextEN: z.string().describe('Ad primary text in English.'),
  headlineTH: z.string().optional().describe('Ad headline in Thai.'),
  headlineEN: z.string().optional().describe('Ad headline in English.'),
  ctaMessagePromptTH: z.string().describe('CTA message prompt in Thai.'),
  ctaMessagePromptEN: z.string().describe('CTA message prompt in English.'),
});

const GenerateAdCopiesOutputSchema = z.array(AdCopySchema).describe('Array of generated ad copies.');

export type GenerateAdCopiesOutput = z.infer<typeof GenerateAdCopiesOutputSchema>;

export async function generateAdCopies(input: GenerateAdCopiesInput): Promise<GenerateAdCopiesOutput> {
  return generateAdCopiesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAdCopiesPrompt',
  input: {schema: GenerateAdCopiesInputSchema},
  output: {schema: GenerateAdCopiesOutputSchema},
  prompt: `You are an expert Facebook Ads copywriter specializing in Message Ads for the Thai market.

Generate {{numberOfAds}} UNIQUE ad copy variations in both Thai and English based on:

**Video Description:** {{{videoDescription}}}

**Structure for each copy (Hook → Benefit → CTA):**
1. **primaryTextTH/primaryTextEN:** 3-5 lines, compelling. Max ~500 chars. Highlight key benefits, use 1-2 emojis.
2. **headlineTH/headlineEN:** Short, punchy. Max 40 chars. Main hook or value proposition.
3. **ctaMessagePromptTH/ctaMessagePromptEN:** Greeting when user taps "Send Message". Max 60 chars. Invite action.

**Guidelines:**
- Thai copy: Natural, not robotic. Use appropriate level of formality (ครับ/ค่ะ).
- Vary angles: Price, quality, urgency, social proof, curiosity, problem-solution.
- All variations must encourage users to send a message.
- No false claims (100%, guarantee, cure). Comply with Facebook ad policies.
- Each variation must be distinctly different in approach.

**Example primary text (Thai):** "🔥 สินค้าคุณภาพ ราคาพิเศษ! พร้อมส่งทั่วประเทศ สนใจทักแชทสอบถามได้เลยครับ 💬"
**Example headline (Thai):** "✨ คลิกดูสินค้าและทักแชทเลย!"
**Example CTA (Thai):** "สวัสดีครับ มีอะไรให้ช่วยไหม?"

Return a JSON array of exactly {{numberOfAds}} ad copy objects. Thai and English versions must convey the same meaning.`,
});

const generateAdCopiesFlow = ai.defineFlow(
  {
    name: 'generateAdCopiesFlow',
    inputSchema: GenerateAdCopiesInputSchema,
    outputSchema: GenerateAdCopiesOutputSchema,
  },
  async input => {
    const numberOfAds = input.numberOfAds;
    //If the number of ads exceeds 5, limit the LLM call to only 5 to save tokens
    if (numberOfAds > 5) {
      input = {...input, numberOfAds: 5};
    }
    const {output} = await prompt(input);
    return output!;
  }
);
