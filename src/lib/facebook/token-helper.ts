import { generateCacheKey, setCache, getCached, deleteCache } from '@/lib/cache/redis';
import crypto from 'crypto';

// Interface for Token
export interface TokenInfo {
    token: string;
    name: string;
}

const TOKEN_CACHE_TTL = 3600; // 1 hour

/**
 * Generate App Secret Proof for secure server-side calls
 * Requires FACEBOOK_APP_SECRET in env
 */
export function generateAppSecretProof(accessToken: string): string | null {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) return null;
    return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}


/**
 * Finds a working access token for a specific Page ID.
 * Checks Redis cache first, then tries available tokens.
 */
export async function getValidTokenForPage(
    pageId: string,
    tokens: TokenInfo[]
): Promise<string | null> {
    const cacheKey = generateCacheKey('meta:page_token', pageId);

    // 1. Check Cache
    try {
        const cachedToken = await getCached<string>(cacheKey);
        if (cachedToken) {
            const tokenExists = tokens.some(t => t.token === cachedToken);
            if (tokenExists) {
                return cachedToken;
            } else {
                await deleteCache(cacheKey);
            }
        }
    } catch (err) {
        console.error('Error reading page token cache:', err);
    }

    // 2. Iterate Tokens
    for (const tokenInfo of tokens) {
        try {
            const { token } = tokenInfo;
            const response = await fetch(
                `https://graph.facebook.com/v22.0/${pageId}?fields=name&access_token=${token}`
            );

            if (response.ok) {
                await setCache(cacheKey, token, TOKEN_CACHE_TTL);
                return token;
            }
        } catch (err) {
            // Ignore
        }
    }

    return null;
}

/**
 * Finds a working access token for a specific Ad Account ID.
 * Checks Redis cache first, then tries available tokens.
 * @param adAccountId The Ad Account ID (e.g. act_123456)
 * @param tokens List of available tokens from user and team members
 */
export async function getValidTokenForAdAccount(
    adAccountId: string,
    tokens: TokenInfo[]
): Promise<string | null> {
    const cacheKey = generateCacheKey('meta:account_token', adAccountId);

    // 1. Check Cache
    try {
        const cachedToken = await getCached<string>(cacheKey);
        if (cachedToken) {
            // Verify if cached token is still in our available tokens list
            // (Security: ensure user still has access via that token connection)
            const tokenExists = tokens.some(t => t.token === cachedToken);
            if (tokenExists) {
                return cachedToken;
            } else {
                // Token removed from team or changed, invalidate
                await deleteCache(cacheKey);
            }
        }
    } catch (err) {
        console.error('Error reading token cache:', err);
    }

    // 2. Iterate Tokens if no cache hit
    for (const tokenInfo of tokens) {
        try {
            const { token } = tokenInfo;

            // Lightweight check
            const response = await fetch(
                `https://graph.facebook.com/v22.0/${adAccountId}?fields=id,currency&access_token=${token}`
            );

            if (response.ok) {
                // Success! Cache this token for future use
                await setCache(cacheKey, token, TOKEN_CACHE_TTL);
                return token;
            }
        } catch (err) {
            // Network error, try next
            console.error(`Error checking token for ${adAccountId}:`, err);
        }
    }

    return null;
}

/**
 * Optimized fetch wrapper that tries to find a working token
 */
export async function fetchWithMultiToken(
    url: string,
    adAccountId: string,
    tokens: TokenInfo[],
    options?: RequestInit
): Promise<Response> {
    const token = await getValidTokenForAdAccount(adAccountId, tokens);

    if (!token) {
        // If we can't find a token, we can't make the request.
        // Return a mock 400 response or throw
        return new Response(JSON.stringify({ error: { message: 'No valid access token found for this account' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Append access_token to URL
    const urlObj = new URL(url);
    urlObj.searchParams.set('access_token', token);

    return fetch(urlObj.toString(), options);
}
