import { NextResponse, type NextRequest } from "next/server";
import type { ScanType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { verifySignature } from "@/lib/ingest-signature";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown, max: number): string | null {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
}

function fail(status: number, error: string) {
    return NextResponse.json({ error }, { status });
}

/**
 * Receives Zad Security requests from zad-landing (/api/security).
 * Each call is signed: X-Zad-Timestamp + X-Zad-Signature = HMAC-SHA256(INGEST_SECRET, "<ts>.<body>").
 */
export async function POST(req: NextRequest) {
    const secret = process.env.INGEST_SECRET;
    if (!secret || secret.length < 32) {
        console.error("INGEST_SECRET is missing or too short; ingest is disabled.");
        return fail(503, "ingest disabled");
    }

    const allowed = (process.env.INGEST_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allowed.length) {
        const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
        if (!allowed.includes(ip)) return fail(403, "forbidden");
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return fail(413, "too large");

    const check = verifySignature(secret, req.headers.get("x-zad-timestamp"), req.headers.get("x-zad-signature"), raw);
    if (!check.ok) {
        console.warn(`ingest rejected: ${check.reason}`);
        return fail(401, "invalid signature");
    }

    let body: Record<string, unknown>;
    try {
        body = JSON.parse(raw);
    } catch {
        return fail(400, "invalid json");
    }

    const externalId = str(body.id, 64);
    const email = str(body.email, 191)?.toLowerCase() ?? null;
    if (!externalId || !email || !EMAIL_PATTERN.test(email)) return fail(400, "missing id or email");

    let type: ScanType;
    let name: string | null = null;
    let phone: string | null = null;
    let target: string | null = null;
    let authorized = false;

    if (body.kind === "notify") {
        type = "NOTIFY";
    } else if (body.kind === "scan") {
        type = body.scanType === "leak" ? "LEAK" : "SITE";
        name = str(body.name, 120);
        phone = str(body.phone, 40);
        target = str(body.target, 500);
        authorized = body.authorized === true;
        if (!name || !target || !/^https?:\/\//i.test(target)) return fail(400, "missing name or target");
    } else {
        return fail(400, "unknown kind");
    }

    const existing = await db.scanRequest.findUnique({ where: { externalId }, select: { id: true } });
    if (existing) return NextResponse.json({ id: existing.id, duplicate: true });

    const created = await db.scanRequest.create({
        data: {
            externalId,
            type,
            name,
            email,
            phone,
            target,
            authorized,
            source: str(body.source, 64),
            ip: str(body.ip, 64),
            userAgent: str(body.userAgent, 255),
        },
    });
    await audit({ actorId: null, action: "request.received", targetType: "scan_request", targetId: String(created.id), details: { type } });
    return NextResponse.json({ id: created.id }, { status: 201 });
}
