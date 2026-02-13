import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';
import { createAuditLog } from '@/lib/audit';
import { createTrialSubscription, hasActiveSubscription } from '@/lib/subscription-utils';
import crypto from 'crypto';

import { prisma } from '@/lib/prisma';

// const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),

    events: {
        async signIn({ user, account, profile, isNewUser }) {
            const provider = account?.provider;
            let action: 'LOGIN_GOOGLE' | 'LOGIN_PASSWORD' | 'LOGIN_ADMIN' | 'LOGIN_FACEBOOK' = 'LOGIN_PASSWORD';
            if (provider === 'google') action = 'LOGIN_GOOGLE';
            else if (provider === 'facebook') action = 'LOGIN_FACEBOOK';
            else if (provider === 'credentials') {
                action = (user as { loginType?: string }).loginType === 'admin' ? 'LOGIN_ADMIN' : 'LOGIN_PASSWORD';
            }
            await createAuditLog({
                userId: user.id,
                action,
                details: {
                    provider,
                    isNewUser,
                    email: user.email
                }
            });

            // Create trial subscription for new OAuth users (Google/Facebook)
            if (isNewUser && (provider === 'google' || provider === 'facebook')) {
                try {
                    // Check if user doesn't already have a subscription
                    const hasSubscription = await hasActiveSubscription(user.id);
                    if (!hasSubscription) {
                        await createTrialSubscription(user.id);
                        console.log('✅ Created trial subscription for OAuth user:', user.email);
                    }
                } catch (trialError) {
                    console.error('⚠️ Failed to create trial subscription for OAuth user:', trialError);
                }
            }
        },
    },

    providers: [
        // Email & Password
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                loginType: { label: 'Type', type: 'text', optional: true },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password required');
                }

                // Get login context
                const loginType = (credentials as any).loginType;

                // --- SCENARIO A: Admin Login Page (loginType = 'admin') ---
                if (loginType === 'admin') {
                    // Check for Hardcoded Super Admin (Env Vars) ONLY
                    const envAdminEmail = process.env.SUPER_ADMIN_EMAIL;
                    const envAdminPass = process.env.SUPER_ADMIN_PASSWORD;

                    if (envAdminEmail && envAdminPass &&
                        credentials.email === envAdminEmail &&
                        credentials.password === envAdminPass) {

                        // Valid Env Admin Credentials -> Login as SUPER_ADMIN
                        let dbUser = await prisma.user.findUnique({
                            where: { email: credentials.email },
                        });

                        // Ensure admin user exists in DB so APIs (campaigns, ads, etc.) can find user by session.user.id
                        if (!dbUser) {
                            const adminId = `admin-${crypto.createHash('sha256').update(envAdminEmail).digest('hex').slice(0, 24)}`;
                            dbUser = await prisma.user.create({
                                data: {
                                    id: adminId,
                                    email: envAdminEmail,
                                    name: 'Super Admin',
                                    role: 'SUPER_ADMIN',
                                },
                            });
                        }

                        return {
                            id: dbUser.id,
                            email: dbUser.email ?? envAdminEmail,
                            name: dbUser.name || 'Super Admin',
                            image: dbUser.image,
                            role: 'SUPER_ADMIN',
                            loginType: 'admin',
                        } as any;
                    }

                    // If Env login fails, we DO NOT fall back to DB user login here 
                    // (Strict separation as requested)
                    throw new Error('Invalid Admin Credentials');
                }

                // --- SCENARIO B: User Login Page (loginType = 'user' or undefined) ---

                // Prevent Env Admin from logging in via User form (unless they exist in DB)
                // We proceed to DB check below.

                // 2. Normal DB Login (for Users)
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user || !user.password) {
                    throw new Error('Invalid email or password');
                }

                const isPasswordValid = await compare(credentials.password, user.password);

                if (!isPasswordValid) {
                    throw new Error('Invalid email or password');
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: (user as any).role,
                    loginType: 'user',
                } as any;
            },
        }),

        // Google OAuth
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        }),

        // Facebook OAuth
        FacebookProvider({
            clientId: process.env.FACEBOOK_APP_ID || '',
            clientSecret: process.env.FACEBOOK_APP_SECRET || '',
            allowDangerousEmailAccountLinking: true,
            authorization: {
                url: "https://www.facebook.com/v22.0/dialog/oauth",
                params: {
                    scope: 'email,public_profile,ads_read,ads_management,pages_read_engagement,pages_show_list,pages_messaging,pages_manage_metadata,pages_manage_ads,business_management',
                    auth_type: 'reauthorize',
                    response_type: 'code',
                },
            },
            token: "https://graph.facebook.com/oauth/access_token",
            userinfo: {
                url: "https://graph.facebook.com/me",
                params: { fields: "id,name,email,picture" },
            },
            profile(profile) {
                return {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture?.data?.url,
                };
            },
        }),
    ],

    pages: {
        signIn: '/login',
        signOut: '/login',
        error: '/login',
        verifyRequest: '/login',
        newUser: '/home',
    },

    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    callbacks: {
        async signIn({ user, account, profile }) {
            // Auto-create MetaAccount + TeamMember when user signs in with Facebook
            if (account?.provider === 'facebook' && account?.access_token && user?.id && account.providerAccountId) {
                try {
                    const fbProfile = profile as { id?: string; name?: string; email?: string } | undefined;
                    const fbName = fbProfile?.name || user.name || 'Facebook User';
                    const fbEmail = fbProfile?.email || user.email || undefined;

                    // Exchange short-lived token for long-lived (~60 days)
                    let accessToken = account.access_token;
                    let expiresAt: Date;
                    try {
                        const { exchangeForLongLivedToken } = await import('@/lib/facebook/token-helper');
                        const { accessToken: longLived, expiresIn } = await exchangeForLongLivedToken(account.access_token);
                        accessToken = longLived;
                        expiresAt = new Date(Date.now() + expiresIn * 1000);
                    } catch (err) {
                        console.warn('Token exchange failed, using short-lived token (~2h). Check FACEBOOK_APP_ID/FACEBOOK_APP_SECRET. User token will expire soon:', (err as Error).message);
                        expiresAt = account.expires_at
                            ? new Date(account.expires_at * 1000)
                            : new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h fallback
                    }

                    // 1. Create/update MetaAccount
                    const existingMetaAccount = await prisma.metaAccount.findUnique({
                        where: { userId: user.id },
                    });

                    if (!existingMetaAccount) {
                        try {
                            const { encryptToken } = await import('@/lib/services/metaClient');
                            const encryptedToken = encryptToken(accessToken);
                            await prisma.metaAccount.create({
                                data: {
                                    userId: user.id,
                                    metaUserId: account.providerAccountId,
                                    accessToken: encryptedToken,
                                    accessTokenExpires: expiresAt,
                                },
                            });
                            console.log('✅ Auto-created MetaAccount for user:', fbEmail || user.email);
                        } catch (err) {
                            console.error('Error encrypting/creating meta account', err);
                        }
                    }

                    // 2. Create/update TeamMember so Facebook account shows in "Facebook Accounts"
                    await prisma.teamMember.upsert({
                        where: { facebookUserId: account.providerAccountId },
                        update: {
                            userId: user.id,
                            facebookName: fbName,
                            facebookEmail: fbEmail ?? undefined,
                            accessToken,
                            accessTokenExpires: expiresAt,
                            role: 'MEMBER',
                            updatedAt: new Date(),
                        },
                        create: {
                            userId: user.id,
                            memberType: 'facebook',
                            facebookUserId: account.providerAccountId,
                            facebookName: fbName,
                            facebookEmail: fbEmail ?? undefined,
                            accessToken,
                            accessTokenExpires: expiresAt,
                            role: 'MEMBER',
                        },
                    });
                    console.log('✅ Auto-added Facebook account to team:', fbName);
                } catch (error) {
                    console.error('Failed to auto-create MetaAccount/TeamMember:', error);
                }
            }
            return true;
        },

        async jwt({ token, user, account, trigger, profile }) {
            // Initial sign in
            if (user) {
                token.id = user.id;
                token.role = (user as any).role || 'USER';

                // Create a database session for tracking
                // This allows us to list active sessions even when using JWT strategy
                try {
                    const sessionId = crypto.randomUUID();
                    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

                    // Basic info (Device info will be updated by heartbeat)
                    await prisma.session.create({
                        data: {
                            id: sessionId,
                            sessionToken: sessionId, // Use UUID as token identifier
                            userId: user.id,
                            expires,
                            lastActive: new Date()
                        }
                    });

                    token.sessionId = sessionId;
                } catch (e) {
                    console.error('Failed to create session record', e);
                }
            }

            // Store login provider so account page can show correct branding (Facebook vs Google)
            if (account?.provider) {
                token.provider = account.provider;
            }

            // Store Facebook access token in JWT
            if (account?.provider === 'facebook' && account?.access_token) {
                token.accessToken = account.access_token;
            }

            // Handle session update
            if (trigger === 'update') {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        role: true,
                    },
                });

                if (dbUser) {
                    token.name = dbUser.name;
                    token.email = dbUser.email;
                    token.picture = dbUser.image;
                    token.role = dbUser.role;
                }
            }

            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                (session as any).sessionId = token.sessionId;
                session.provider = token.provider;
            }

            // Pass access token to session
            if (token.accessToken) {
                (session as any).accessToken = token.accessToken;
            } else if (session.user.id) {
                // Fallback: Try to fetch from DB if not in token (e.g. older sessions or if we decide to stop storing in JWT)
                try {
                    // Check TeamMember first
                    const teamMember = await prisma.teamMember.findFirst({
                        where: { userId: session.user.id, memberType: 'facebook' },
                        select: { accessToken: true }
                    });

                    if (teamMember?.accessToken) {
                        (session as any).accessToken = teamMember.accessToken;
                    }
                    // Then MetaAccount
                    else {
                        const metaAccount = await prisma.metaAccount.findUnique({
                            where: { userId: session.user.id },
                            select: { accessToken: true }
                        });

                        if (metaAccount?.accessToken) {
                            const { decryptToken } = await import('@/lib/services/metaClient');
                            (session as any).accessToken = decryptToken(metaAccount.accessToken);
                        }
                    }
                } catch (e) {
                    // Ignore errors fetching extra tokens
                }
            }
            return session;
        },
    },

    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV === 'development',
};
