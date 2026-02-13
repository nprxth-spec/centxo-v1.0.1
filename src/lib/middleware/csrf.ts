/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for CSRF protection
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

// Use NEXTAUTH_SECRET for CSRF - must be set in production
if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET must be set in production for CSRF protection');
}
const CSRF_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-not-for-production';

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token from request
 * @param request - Next.js request object
 * @returns true if valid, false otherwise
 */
export function verifyCsrfToken(request: NextRequest): boolean {
    // Skip CSRF check for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        return true;
    }

    // Get token from header
    const headerToken = request.headers.get(CSRF_TOKEN_HEADER);

    // Get token from cookie
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

    // Both must exist and match
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
        return false;
    }

    return true;
}

/**
 * CSRF middleware for API routes
 * @param request - Next.js request object
 * @returns Response if CSRF check fails, null otherwise
 */
export function csrfProtection(request: NextRequest): NextResponse | null {
    const isValid = verifyCsrfToken(request);

    if (!isValid) {
        return NextResponse.json(
            {
                error: 'Invalid CSRF token',
                message: 'CSRF validation failed. Please refresh the page and try again.',
            },
            { status: 403 }
        );
    }

    return null;
}

/**
 * Add CSRF token to response
 * Call this in API routes that need CSRF protection
 */
export function addCsrfToken(response: NextResponse): NextResponse {
    const token = generateCsrfToken();

    // Set cookie
    response.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
    });

    // Also set in header for easy access
    response.headers.set(CSRF_TOKEN_HEADER, token);

    return response;
}

/**
 * Get CSRF token from request cookies
 * Use this in client-side code to get the token for API calls
 */
export function getCsrfTokenFromRequest(request: NextRequest): string | undefined {
    return request.cookies.get(CSRF_COOKIE_NAME)?.value;
}
