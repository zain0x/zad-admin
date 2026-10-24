import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkServerCall } from "@/lib/server-to-server";
import { normaliseCode } from "@/lib/certificates/code";
import { certificatePng, certificatesPdf } from "@/lib/certificates/pdf";
import { TEMPLATE_VERSION } from "@/lib/certificates/template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The certificate file for zad.gg/cert/<code>: "certificate.png" (shown on the page) or
 * "certificate.pdf" (download, active certificates only). Signed like the JSON endpoint,
 * over "GET /api/public/cert/<code>/<file>".
 */
const FILES = { "certificate.png": "image/png", "certificate.pdf": "application/pdf" } as const;
type FileName = keyof typeof FILES;

// Rendering takes ~1 s, so recent files are kept in memory; an edit, a revoke or a new TEMPLATE_VERSION draws them again.
const cache = new Map<string, Buffer>();
const CACHE_MAX = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string; file: string }> }) {
    const p = await params;
    const code = normaliseCode(p.code);
    if (!(p.file in FILES)) return NextResponse.json({ error: "not found" }, { status: 404 });
    const file = p.file as FileName;

    const check = checkServerCall(req, `GET /api/public/cert/${code}/${file}`);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: check.reason === "disabled" ? 503 : 401 });

    const cert = await db.certificate.findUnique({ where: { code } });
    if (!cert) return NextResponse.json({ found: false }, { status: 404 });
    if (file === "certificate.pdf" && cert.status !== "ACTIVE") return NextResponse.json({ error: "revoked" }, { status: 410 });

    const key = `${code}:${file}:${cert.updatedAt.getTime()}:${TEMPLATE_VERSION}`;
    let body = cache.get(key);
    if (!body) {
        try {
            body = file === "certificate.png" ? await certificatePng(cert) : await certificatesPdf([cert]);
        } catch (err) {
            console.error("Public certificate render failed", err);
            return NextResponse.json({ error: "render failed" }, { status: 500 });
        }
        cache.set(key, body);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    }
    return new NextResponse(new Uint8Array(body), {
        headers: {
            "Content-Type": FILES[file],
            "Cache-Control": "no-store",
            "X-Certificate-Name": encodeURIComponent(cert.nameEn),
        },
    });
}
