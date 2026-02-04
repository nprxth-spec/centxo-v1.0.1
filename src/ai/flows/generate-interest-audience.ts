'use server';

/**
 * AI flow: Generate Facebook interest targeting keywords from a natural language description.
 * Outputs interest names in English for Meta's adinterest search API.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({
  description: z.string().min(5).describe('User description of target audience in Thai or English'),
});

const OutputSchema = z.object({
  interests: z.array(z.string()).min(3).max(15).describe('Array of Facebook interest names in English for Meta adinterest API'),
  suggestedName: z.string().optional().describe('Short suggested preset name'),
});

export type GenerateInterestAudienceInput = z.infer<typeof InputSchema>;
export type GenerateInterestAudienceOutput = z.infer<typeof OutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateInterestAudiencePrompt',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `You are a Facebook Ads targeting expert. The user describes their target audience in natural language (Thai or English).

**User description:** {{description}}

**Your task:**
1. Infer the target audience's interests, hobbies, and behaviors
2. Output 5-12 Facebook interest names in ENGLISH that match Meta's adinterest taxonomy
3. Use broad, well-known interest names that exist in Facebook targeting (e.g. "Fashion", "Beauty", "Online Shopping", "Skincare", "Makeup", "Women's Fashion", "Shopping", "Lifestyle", "Health")
4. Avoid overly specific or niche phrases that may not exist in Meta's interest database
5. If the description is in Thai, suggest a short preset name in Thai (e.g. "ผู้หญิงแฟชั่น-ความงาม"). Otherwise suggest in English.`,
});

const generateInterestFlow = ai.defineFlow(
  { name: 'generateInterestAudience', inputSchema: InputSchema, outputSchema: OutputSchema },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function generateInterestAudience(input: GenerateInterestAudienceInput): Promise<GenerateInterestAudienceOutput> {
  return generateInterestFlow(input);
}
