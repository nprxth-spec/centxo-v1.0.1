import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export type AuditAction =
    | 'LOGIN_GOOGLE'
    | 'LOGIN_PASSWORD'
    | 'LOGIN_ADMIN'
    | 'LOGIN_FACEBOOK'
    | 'USER_REGISTER'
    | 'PASSWORD_CHANGE'
    | 'PASSWORD_ADD'
    | 'CREATE_CAMPAIGN'
    | 'CREATE_CAMPAIGN_MULTI'
    | 'BOOST_POST'
    | 'EXPORT_GOOGLE_SHEET'
    | 'EXPORT_GOOGLE_SHEET_TRIGGER'
    | 'ADD_EXPORT_CONFIG'
    | 'UPDATE_EXPORT_CONFIG'
    | 'DELETE_EXPORT_CONFIG'
    | 'UPDATE_USER_PROFILE'
    | 'META_CONNECT'
    | 'TEAM_ADD_MEMBER'
    | 'DISCONNECT_ACCOUNT'
    | 'USER_DELETE'
    | 'LAUNCH_VIDEO'
    | 'SYNC_INTERESTS'
    | 'DATA_DELETION_REQUEST'
    | 'UPDATE_CAMPAIGN'
    | 'PAUSE_CAMPAIGN'
    | 'RESUME_CAMPAIGN'
    | 'UPDATE_AD'
    | 'PAUSE_AD'
    | 'RESUME_AD'
    | 'AUTO_RULES_PAUSE'
    | 'API_ERROR';

interface CreateLogParams {
    userId?: string;
    action: AuditAction | string;
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Extract IP and User-Agent from NextRequest
 * Supports: x-forwarded-for, x-real-ip, cf-connecting-ip (Cloudflare), true-client-ip, connection.remoteAddress (localhost)
 */
export function getRequestMetadata(req: NextRequest): { ipAddress: string; userAgent: string } {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfIp = req.headers.get('cf-connecting-ip'); // Cloudflare
    const trueClientIp = req.headers.get('true-client-ip'); // Akamai/Vercel
    const forwardedProto = req.headers.get('forwarded'); // RFC 7239: for=1.2.3.4

    let ipAddress =
        forwarded?.split(',')[0]?.trim() ||
        realIp ||
        cfIp ||
        trueClientIp ||
        (forwardedProto?.match(/for="?([^";]+)/)?.[1]?.trim()) ||
        null;

    // Node.js: connection.remoteAddress (works on localhost)
    if (!ipAddress) {
        const reqAny = req as { connection?: { remoteAddress?: string }; socket?: { remoteAddress?: string } };
        ipAddress =
            reqAny?.connection?.remoteAddress ||
            reqAny?.socket?.remoteAddress ||
            null;
        // Normalize IPv6-mapped IPv4 (::ffff:127.0.0.1 -> 127.0.0.1)
        if (ipAddress?.startsWith('::ffff:')) {
            ipAddress = ipAddress.slice(7);
        }
    }

    return {
        ipAddress: ipAddress || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
    };
}

export async function createAuditLog(params: CreateLogParams) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: params.userId,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                details: params.details ? JSON.parse(JSON.stringify(params.details)) : undefined,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
            }
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw, logging shouldn't break the app flow
    }
}
