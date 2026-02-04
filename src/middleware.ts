import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    const token = await getToken({ req });
    const isAuth = !!token;
    const isSuperAdmin = token?.role === "SUPER_ADMIN";
    const { pathname } = req.nextUrl;

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
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        // Allowed
        return NextResponse.next();
    }

    // 3. Protected App Routes (/dashboard, etc)
    // Matches config.matcher excluding admin
    const appProtectedPaths = ["/dashboard", "/settings", "/launch", "/create-ads", "/ads-manager", "/tools"];
    if (appProtectedPaths.some(path => pathname.startsWith(path))) {
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
        "/dashboard/:path*",
        "/settings/:path*",
        "/launch/:path*",
        "/create-ads/:path*",
        "/ads-manager/:path*",
        "/tools/:path*",
        "/admin/:path*"
    ],
};
