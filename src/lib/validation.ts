/**
 * Input Validation Schemas
 * Zod schemas for validating API request inputs
 */

import { z } from 'zod';

// Launch Campaign Schema
export const launchCampaignSchema = z.object({
    videoPath: z.string().min(1, 'Video path is required'),
    pageId: z.string().min(1, 'Page ID is required'),
    numberOfAds: z.number().int().min(1, 'At least 1 ad required').max(10, 'Maximum 10 ads allowed'),
    campaignName: z.string().optional(),
    dailyBudget: z.number().min(1, 'Daily budget must be at least $1').max(1000, 'Daily budget cannot exceed $1000').default(20),
    productContext: z.string().optional(),
});

// Update Campaign Status Schema
export const updateCampaignStatusSchema = z.object({
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED'], {
        errorMap: () => ({ message: 'Status must be ACTIVE, PAUSED, or ARCHIVED' }),
    }),
});

// Update Ad Status Schema
export const updateAdStatusSchema = z.object({
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED'], {
        errorMap: () => ({ message: 'Status must be ACTIVE, PAUSED, or ARCHIVED' }),
    }),
});

// Meta Account Selection Schema
export const metaAccountSelectionSchema = z.object({
    adAccountId: z.string().min(1, 'Ad account ID is required'),
    adAccountName: z.string().min(1, 'Ad account name is required'),
    pageId: z.string().min(1, 'Page ID is required'),
    pageName: z.string().min(1, 'Page name is required'),
});

// Query Parameters Schema
export const campaignsQuerySchema = z.object({
    adAccountId: z.string().min(1, 'Ad account ID is required'),
});

// Ad Account Details Query Schema
export const adAccountDetailsQuerySchema = z.object({
    adAccountId: z.string().min(1, 'Ad account ID is required'),
});

// Campaign Create Schema (FormData validation)
export const campaignCreateSchema = z.object({
    adAccountId: z.string().min(1, 'Ad account ID is required'),
    campaignObjective: z.enum(['OUTCOME_ENGAGEMENT', 'OUTCOME_TRAFFIC', 'OUTCOME_SALES'], {
        errorMap: () => ({ message: 'Invalid campaign objective' }),
    }),
    pageId: z.string().min(1, 'Page ID is required'),
    mediaType: z.enum(['video', 'image']).optional(),
    dailyBudget: z.string().optional().transform((val) => {
        if (!val) return null;
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
    }).refine((val) => val === null || val >= 1, {
        message: 'Daily budget must be at least 1',
    }),
    campaignCount: z.string().optional().transform((val) => {
        const num = parseInt(val || '1', 10);
        return Math.min(10, Math.max(1, isNaN(num) ? 1 : num));
    }),
    adSetCount: z.string().optional().transform((val) => {
        const num = parseInt(val || '1', 10);
        return Math.min(10, Math.max(1, isNaN(num) ? 1 : num));
    }),
    adsCount: z.string().optional().transform((val) => {
        const num = parseInt(val || '1', 10);
        return Math.min(20, Math.max(1, isNaN(num) ? 1 : num));
    }),
    targetCountry: z.string().length(2, 'Country code must be 2 characters').default('TH'),
    placements: z.string().optional().transform((val) => {
        if (!val) return ['facebook', 'instagram', 'messenger'];
        return val.split(',').filter((p) => ['facebook', 'instagram', 'messenger'].includes(p));
    }),
    ageMin: z.string().optional().transform((val) => {
        const num = parseInt(val || '20', 10);
        return Math.min(65, Math.max(18, isNaN(num) ? 20 : num));
    }),
    ageMax: z.string().optional().transform((val) => {
        const num = parseInt(val || '50', 10);
        return Math.min(65, Math.max(18, isNaN(num) ? 50 : num));
    }),
    beneficiaryName: z.string().optional(),
    primaryText: z.string().max(2000, 'Primary text too long').optional(),
    headline: z.string().max(255, 'Headline too long').optional(),
    greeting: z.string().max(300, 'Greeting too long').optional(),
    productContext: z.string().max(1000, 'Product context too long').optional(),
    existingVideo: z.string().optional(),
    existingPostId: z.string().optional(),
    existingFbVideoId: z.string().optional(),
    existingFbVideoUrl: z.string().url().optional().or(z.literal('')),
    existingFbVideoThumbnailUrl: z.string().url().optional().or(z.literal('')),
    manualIceBreakers: z.string().optional().transform((val) => {
        if (!val) return null;
        try {
            const parsed = JSON.parse(val);
            if (!Array.isArray(parsed)) return null;
            return parsed
                .filter((x: any) => x?.question != null)
                .map((x: any) => ({
                    question: String(x.question).slice(0, 80),
                    payload: String(x.payload ?? '').slice(0, 300),
                }));
        } catch {
            return null;
        }
    }),
    exclusionAudienceIds: z.string().optional().transform((val) => {
        if (!val) return [] as string[];
        try {
            const parsed = JSON.parse(val);
            if (!Array.isArray(parsed)) return [] as string[];
            return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
        } catch {
            return [] as string[];
        }
    }),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

/**
 * Helper to parse FormData to object for Zod validation
 */
export function formDataToObject(formData: FormData): Record<string, string> {
    const obj: Record<string, string> = {};
    formData.forEach((value, key) => {
        // Skip File objects
        if (typeof value === 'string') {
            obj[key] = value;
        }
    });
    return obj;
}

/**
 * Helper function to validate request body
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result
 */
export function validateRequestBody<T>(schema: z.ZodSchema<T>, data: unknown) {
    return schema.safeParse(data);
}

/**
 * Helper function to validate query parameters
 * @param schema - Zod schema to validate against
 * @param searchParams - URLSearchParams object
 * @returns Validation result
 */
export function validateQueryParams<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams) {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return schema.safeParse(params);
}
