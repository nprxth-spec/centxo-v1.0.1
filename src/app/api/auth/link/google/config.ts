const APP_URL = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
export const GOOGLE_LINK_REDIRECT_URI = `${APP_URL}/api/auth/link/google/callback`;
