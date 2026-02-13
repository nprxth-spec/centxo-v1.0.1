import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    const token = await getToken({ req });
    const isAuth = !!token;
    const isSuperAdmin = token?.role === "SUPER_ADMIN";
    const { pathname, searchParams } = req.nextUrl;

    // 1. Admin Login Page
    if (pathname === "/admin/login") {
        if (isAuth && isSuperAdmin) {
            // Already admin? Go to dashboard
            return NextResponse.redirect(new URL("/admin", req.url));
        }
        // Allow access to login page
        return NextResponse.next();
    }

    // 2. Protected Admin Routes (/admin/*)
    if (pathname.startsWith("/admin")) {
        if (!isAuth) {
            // Not logged in -> Go to Admin Login
            const url = new URL("/admin/login", req.url);
            url.searchParams.set("callbackUrl", pathname);
            return NextResponse.redirect(url);
        }

        if (!isSuperAdmin) {
            // Logged in but not admin -> Kick to main dashboard (or 403)
            return NextResponse.redirect(new URL("/", req.url));
        }

        // Allowed
        return NextResponse.next();
    }

    // ============================================
    // Route Redirects for Minimal Navigation
    // ============================================
    
    // Redirect /dashboard to /home
    if (pathname === "/dashboard") {
        return NextResponse.redirect(new URL("/home", req.url));
    }

    // Redirect /account to /settings (account settings are now in /settings)
    if (pathname === "/account" || pathname.startsWith("/account/")) {
        const url = new URL("/settings", req.url);
        // Preserve any existing query params
        const tab = searchParams.get('tab');
        if (tab) url.searchParams.set('tab', tab);
        return NextResponse.redirect(url);
    }

    // Redirect old adbox-v to inbox
    if (pathname === "/adbox-v" || pathname.startsWith("/adbox-v/")) {
        return NextResponse.redirect(new URL("/inbox", req.url));
    }
    
    // Redirect /adbox to /inbox
    if (pathname === "/adbox" || pathname.startsWith("/adbox/")) {
        return NextResponse.redirect(new URL("/inbox", req.url));
    }

    // Redirect /launch to /create?tab=quick
    if (pathname === "/launch") {
        return NextResponse.redirect(new URL("/create?tab=quick", req.url));
    }

    // Redirect /create-ads to /create?tab=auto
    if (pathname === "/create-ads") {
        return NextResponse.redirect(new URL("/create?tab=auto", req.url));
    }

    // Redirect /ads-manager/* to /ads?tab=*
    if (pathname.startsWith("/ads-manager")) {
        const url = new URL("/ads", req.url);
        
        if (pathname.includes("/campaigns")) {
            url.searchParams.set('tab', 'campaigns');
        } else if (pathname.includes("/accounts")) {
            url.searchParams.set('tab', 'accounts');
        } else if (pathname.includes("/google-sheets-export")) {
            url.searchParams.set('tab', 'export');
        } else {
            url.searchParams.set('tab', 'campaigns');
        }
        
        return NextResponse.redirect(url);
    }

    // Redirect /audiences to /tools?tab=audiences
    if (pathname === "/audiences" || pathname.startsWith("/audiences/")) {
        return NextResponse.redirect(new URL("/tools?tab=audiences", req.url));
    }

    // Redirect old /tools/* paths to new /tools?tab=*
    if (pathname === "/tools/creative-variants") {
        return NextResponse.redirect(new URL("/tools?tab=creative", req.url));
    }
    if (pathname === "/tools/auto-rules") {
        return NextResponse.redirect(new URL("/tools?tab=rules", req.url));
    }

    // Redirect /settings/manage-access to /settings?tab=subscription (integrated)
    if (pathname === "/settings/manage-access") {
        return NextResponse.redirect(new URL("/settings?tab=subscription", req.url));
    }

    // Redirect /settings/ad-accounts - page/account selection is now in Manage Resources (subscription tab only)
    if (pathname === "/settings/ad-accounts") {
        return NextResponse.redirect(new URL("/settings?tab=subscription", req.url));
    }

    // 3. Protected App Routes
    const appProtectedPaths = ["/home", "/ads", "/create", "/settings", "/inbox", "/tools"];
    if (appProtectedPaths.some(path => pathname === path || pathname.startsWith(path + "/"))) {
        if (!isAuth) {
            const url = new URL("/login", req.url);
            url.searchParams.set("callbackUrl", pathname);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // New routes
        "/home/:path*",
        "/ads/:path*",
        "/create/:path*",
        "/settings/:path*",
        "/inbox/:path*",
        "/tools/:path*",
        
        // Old routes (for redirects)
        "/dashboard/:path*",
        "/account/:path*",
        "/launch/:path*",
        "/create-ads/:path*",
        "/ads-manager/:path*",
        "/adbox/:path*",
        "/adbox-v",
        "/adbox-v/:path*",
        "/audiences/:path*",
        
        // Admin routes
        "/admin/:path*"
    ],
};
