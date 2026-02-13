'use server';

/**
 * @fileOverview A flow to automate ad optimization with AI suggestions.
 *
 * - automateAdOptimization - A function that orchestrates the ad optimization process.
 * - AdOptimizationInput - The input type for the automateAdOptimization function.
 * - AdOptimizationOutput - The return type for the automateAdOptimization function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AdPerformanceDataSchema = z.object({
  adId: z.string().describe('The ID of the ad.'),
  spend: z.number().describe('The amount spent on the ad.'),
  messages: z.number().describe('The number of messages received from the ad.'),
  costPerMessage: z.number().describe('The cost per message for the ad.'),
  audience: z.string().optional().describe('The audience targeting used for this ad (e.g., "Broad", "Interests: Tech").'),
});

const AdOptimizationInputSchema = z.object({
  campaignId: z.string().describe('The ID of the campaign.'),
  adPerformanceData: z
    .array(AdPerformanceDataSchema)
    .describe('Performance data for each ad in the campaign.'),
  medianCostPerMessage: z.number().describe('Median cost per message for all ads in the campaign'),
  xSpendThreshold: z.number().describe('The spend threshold for pausing ads'),
  costPerMessageMultiplier: z.number().default(1.5).describe('Multiplier for cost per message threshold (default: 1.5)'),
  minMessagesForWinner: z.number().default(3).describe('Minimum messages to consider an ad a winner (default: 3)'),
  minSpendToEvaluate: z.number().optional().describe('Minimum spend (USD) before evaluating an ad (skip if below)'),
});

export type AdOptimizationInput = z.infer<typeof AdOptimizationInputSchema>;

const SuggestedActionSchema = z.object({
  type: z.enum(['rule_change', 'budget', 'audience', 'creative', 'other']),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

const AdOptimizationOutputSchema = z.object({
  adsToPause: z.array(z.string()).describe('The IDs of the ads to pause.'),
  winningAds: z.array(z.string()).describe('The IDs of the winning ads.'),
  aiSuggestions: z
    .string()
    .describe(
      'AI suggestions for optimizing ad performance, including changes to rules, bid strategies, or audiences.'
    ),
  decisionLog: z.array(z.string()).describe('Log of decisions made during the optimization process.'),
  suggestedActions: z
    .array(SuggestedActionSchema)
    .optional()
    .describe('Structured suggestions (rule changes, budget, audience, creative).'),
});

export type AdOptimizationOutput = z.infer<typeof AdOptimizationOutputSchema>;
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

export async function automateAdOptimization(input: AdOptimizationInput): Promise<AdOptimizationOutput> {
  return automateAdOptimizationFlow(input);
}

const adOptimizationPrompt = ai.definePrompt({
  name: 'adOptimizationPrompt',
  input: { schema: AdOptimizationInputSchema },
  output: { schema: AdOptimizationOutputSchema },
  prompt: `You are an AI-powered Facebook Message Ads optimization expert.

Analyze the performance data and provide recommendations.

**Ad Performance Data:** {{JSON.stringify adPerformanceData}}

**Rule Parameters:**
- Median cost per message: {{medianCostPerMessage}}
- Spend threshold for pausing: {{xSpendThreshold}}
- Cost/message multiplier: {{costPerMessageMultiplier}}
- Min messages for winner: {{minMessagesForWinner}}

**Rules (applied by system):**
1. PAUSE: spend >= {{xSpendThreshold}} AND messages = 0
2. PAUSE: costPerMessage > median * {{costPerMessageMultiplier}}
3. WINNER: messages >= {{minMessagesForWinner}} AND costPerMessage < median
(Note: If an ad qualifies for both PAUSE and WINNER, PAUSE takes precedence.)

**Your Output:**
- adsToPause: Array of ad IDs to pause (must match rules above)
- winningAds: Array of ad IDs that are winners (exclude any in adsToPause)
- aiSuggestions: 2-4 concrete suggestions (e.g., "Consider increasing budget on winning ads", "Test broader audience on Ad X")
- decisionLog: Brief reasoning for each pause/winner decision
- suggestedActions: Optional array of { type: "rule_change"|"budget"|"audience"|"creative"|"other", description: string, priority?: "high"|"medium"|"low" }`,
});

const automateAdOptimizationFlow = ai.defineFlow(
  {
    name: 'automateAdOptimizationFlow',
    inputSchema: AdOptimizationInputSchema,
    outputSchema: AdOptimizationOutputSchema,
  },
  async input => {
    const adsToPauseSet = new Set<string>();
    const winningAds: string[] = [];
    const decisionLog: string[] = [];

    const multiplier = input.costPerMessageMultiplier ?? 1.5;
    const minMessages = input.minMessagesForWinner ?? 3;
    const minSpend = input.minSpendToEvaluate ?? 0;

    input.adPerformanceData.forEach(ad => {
      if (minSpend > 0 && ad.spend < minSpend) {
        decisionLog.push(`Ad ${ad.adId} skipped: spend ${ad.spend} < min ${minSpend}`);
        return;
      }

      let shouldPause = false;

      if (ad.spend >= input.xSpendThreshold && ad.messages === 0) {
        adsToPauseSet.add(ad.adId);
        decisionLog.push(`Ad ${ad.adId} paused: spend >= ${input.xSpendThreshold} and 0 messages.`);
        shouldPause = true;
      }

      const threshold = input.medianCostPerMessage * multiplier;
      if (ad.costPerMessage > threshold && ad.costPerMessage !== Infinity) {
        adsToPauseSet.add(ad.adId);
        decisionLog.push(`Ad ${ad.adId} paused: cost/message ${ad.costPerMessage.toFixed(2)} > median*${multiplier} (${threshold.toFixed(2)}).`);
        shouldPause = true;
      }

      if (!shouldPause && ad.messages >= minMessages && ad.costPerMessage < input.medianCostPerMessage) {
        winningAds.push(ad.adId);
        decisionLog.push(`Ad ${ad.adId} winner: messages >= ${minMessages}, cost/message < median.`);
      }
    });

    const adsToPause = Array.from(adsToPauseSet);

    const { output } = await adOptimizationPrompt({
      ...input,
      adPerformanceData: input.adPerformanceData,
    });

    return {
      adsToPause,
      winningAds,
      aiSuggestions: output?.aiSuggestions ?? 'No suggestions provided.',
      decisionLog: [...decisionLog, ...(output?.decisionLog ?? [])],
      suggestedActions: output?.suggestedActions ?? [],
    };
  }
);
