/**
 * Environment Variable Validation
 * Validates all required environment variables on application startup
 */

import { z } from 'zod';

const envSchema = z.object({
  // NextAuth
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Facebook/Meta
  FACEBOOK_APP_ID: z.string().min(1, 'FACEBOOK_APP_ID is required'),
  FACEBOOK_APP_SECRET: z.string().min(1, 'FACEBOOK_APP_SECRET is required'),
  FACEBOOK_REDIRECT_URI: z.string().url('FACEBOOK_REDIRECT_URI must be a valid URL'),
  FACEBOOK_SCOPE: z.string().optional(),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Google AI
  GOOGLE_API_KEY: z.string().min(1, 'GOOGLE_API_KEY is required'),

  // Encryption
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters')
    .refine(
      (key) => key !== 'default-key-change-in-production',
      'ENCRYPTION_KEY cannot be the default value in production'
    ),

  // Cron Secret
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters').optional(),

  // Graph API
  GRAPH_API_VERSION: z.string().default('v21.0'),

  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Validates and returns environment variables
 * Throws error if validation fails
 */
export function validateEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = envSchema.parse(process.env);
    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(
        `❌ Environment variable validation failed:\n${errorMessages}\n\nPlease check your .env.local file.`
      );
    }
    throw error;
  }
}

/**
 * Get validated environment variables
 * Safe to use after validateEnv() has been called
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    throw new Error('Environment variables not validated. Call validateEnv() first.');
  }
  return cachedEnv;
}

// Validate on module load in production
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}
