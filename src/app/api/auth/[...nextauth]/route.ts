import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rateLimit';
import { NextRequest } from 'next/server';

const handler = NextAuth(authOptions);

export async function GET(req: NextRequest, context: any) {
  return (handler as any)(req, context);
}

export async function POST(req: NextRequest, context: any) {
  // Rate limit credentials login to prevent brute force
  const pathname = req.nextUrl?.pathname || '';
  if (pathname.includes('callback/credentials')) {
    const rateLimitResponse = await rateLimit(req, RateLimitPresets.auth);
    if (rateLimitResponse) return rateLimitResponse;
  }
  return (handler as any)(req, context);
}
