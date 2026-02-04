/**
 * Rate Limiting Middleware
 * Protects API routes from abuse
 * Uses Redis for distributed rate limiting (production)
 * Falls back to in-memory storage (development/single instance)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

// Initialize Redis client for rate limiting
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

// Fallback in-memory storage for development
class InMemoryRateLimiter {
    private requests: Map<string, number[]> = new Map();

    check(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number } {
        const now = Date.now();
        const requests = this.requests.get(key) || [];
        const validRequests = requests.filter((timestamp) => now - timestamp < config.windowMs);

        if (validRequests.length >= config.maxRequests) {
            return { allowed: false, remaining: 0 };
        }

        validRequests.push(now);
        this.requests.set(key, validRequests);

        // Cleanup old entries periodically
        if (Math.random() < 0.01) {
            this.cleanup(config.windowMs);
        }

        return { allowed: true, remaining: config.maxRequests - validRequests.length };
    }

    private cleanup(windowMs: number) {
        const now = Date.now();
        for (const [key, timestamps] of this.requests.entries()) {
            const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);
            if (validTimestamps.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, validTimestamps);
            }
        }
    }

    reset(key: string) {
        this.requests.delete(key);
    }
}

const inMemoryLimiter = new InMemoryRateLimiter();

/**
 * Check rate limit using Redis (distributed) or in-memory (fallback)
 */
async function checkRateLimit(
    key: string,
    config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const windowSec = Math.ceil(config.windowMs / 1000);
    const resetAt = Date.now() + config.windowMs;

    // Use Redis if available
    if (redis) {
        try {
            const redisKey = `ratelimit:${key}`;
            const current = await redis.incr(redisKey);

            // Set expiry on first request
            if (current === 1) {
                await redis.expire(redisKey, windowSec);
            }

            const remaining = Math.max(0, config.maxRequests - current);
            return {
                allowed: current <= config.maxRequests,
                remaining,
                resetAt,
            };
        } catch (error) {
            console.warn('Redis rate limit failed, falling back to in-memory:', error);
            // Fall through to in-memory
        }
    }

    // Fallback to in-memory
    const result = inMemoryLimiter.check(key, config);
    return { ...result, resetAt };
}

/**
 * Rate limit middleware for API routes
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @param identifier - Optional custom identifier (e.g., session.user.id)
 * @returns Response if rate limited, null otherwise
 */
export async function rateLimit(
    request: NextRequest,
    config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 },
    identifier?: string
): Promise<NextResponse | null> {
    // Get identifier (prefer custom identifier, then header, fallback to IP)
    const headerUserId = request.headers.get('x-user-id');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
    const key = identifier || headerUserId || ip;

    const { allowed, remaining, resetAt } = await checkRateLimit(key, config);

    if (!allowed) {
        return NextResponse.json(
            {
                error: 'Too many requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(config.windowMs / 1000),
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil(config.windowMs / 1000)),
                    'X-RateLimit-Limit': String(config.maxRequests),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(resetAt),
                },
            }
        );
    }

    return null;
}

/**
 * Synchronous rate limit check (for backward compatibility)
 * Uses only in-memory storage
 */
export function rateLimitSync(
    request: NextRequest,
    config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 },
    identifier?: string
): NextResponse | null {
    const headerUserId = request.headers.get('x-user-id');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
    const key = identifier || headerUserId || ip;

    const { allowed, remaining } = inMemoryLimiter.check(key, config);

    if (!allowed) {
        return NextResponse.json(
            {
                error: 'Too many requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(config.windowMs / 1000),
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.ceil(config.windowMs / 1000)),
                    'X-RateLimit-Limit': String(config.maxRequests),
                    'X-RateLimit-Remaining': String(remaining),
                },
            }
        );
    }

    return null;
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
    // Strict limits for sensitive operations
    strict: { maxRequests: 10, windowMs: 60000 }, // 10 per minute

    // Standard limits for general API routes
    standard: { maxRequests: 100, windowMs: 60000 }, // 100 per minute

    // Relaxed limits for read-only operations
    relaxed: { maxRequests: 300, windowMs: 60000 }, // 300 per minute

    // Very strict for authentication
    auth: { maxRequests: 5, windowMs: 300000 }, // 5 per 5 minutes

    // Campaign creation (expensive operation)
    campaignCreate: { maxRequests: 10, windowMs: 300000 }, // 10 per 5 minutes

    // AI analysis (expensive operation)
    aiAnalysis: { maxRequests: 20, windowMs: 300000 }, // 20 per 5 minutes
};

export { inMemoryLimiter as globalLimiter };
