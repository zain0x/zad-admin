import { NextResponse, type NextRequest } from "next/server";

// Cheap first gate: no session cookie → login page. The real check (database,
// expiry, 2FA, role) runs on the server in every page and action.
// /api/ingest and /api/public are checked by their own HMAC signature (and by IP in Nginx on the server).
const PUBLIC_PATHS = ["/login", "/api/health", "/api/ingest", "/api/public"];
const COOKIES = ["__Host-zad_admin", "zad_admin_session"];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return NextResponse.next();
    }
    if (COOKIES.some((c) => req.cookies.has(c))) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
    matcher: ["/((?!_next/|fonts/|brand/|favicon.ico|robots.txt).*)"],
};
