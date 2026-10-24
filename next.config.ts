import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Strict browser policy: this app talks to nobody but itself.
const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    // The certificate preview is shown in an iframe on this same site.
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
].join("; ");

const securityHeaders = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
    turbopack: { root: process.cwd() },
    // Playwright drives a real Chromium to print certificates to PDF; keep it out of the bundle.
    serverExternalPackages: ["playwright", "playwright-core"],
    // Staff attach reports and screenshots to scan requests (lib/uploads.ts caps each file at 20 MB).
    experimental: { serverActions: { bodySizeLimit: "25mb" } },
    poweredByHeader: false,
    async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
    },
};

export default nextConfig;
