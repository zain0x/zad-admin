import { after, NextResponse, type NextRequest } from "next/server";
import type { ScanType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { verifySignature } from "@/lib/ingest-signature";
import { isCompanyDomain } from "@/lib/breach/domains";
import { seal } from "@/lib/auth/secret-box";
import { alertTelegram, esc, maskEmail } from "@/lib/telegram";

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
 * Receives from zad-landing: scan requests (/api/security), breach-alert sign-ups
 * (→ email monitoring) and anonymous breach-check stats (/api/security/breach).
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

    // Anonymous stats of a breach check made on the site (no email, only its HMAC).
    if (body.kind === "breach_check") {
        const emailHash = typeof body.emailHash === "string" && /^[0-9a-f]{64}$/.test(body.emailHash) ? body.emailHash : null;
        const breachCount = Number.isInteger(body.breachCount) ? Math.min(Math.max(Number(body.breachCount), 0), 10000) : null;
        if (!emailHash || breachCount === null) return fail(400, "invalid stats");
        const names = Array.isArray(body.breaches)
            ? body.breaches.filter((n): n is string => typeof n === "string").map((n) => n.slice(0, 120)).slice(0, 200)
            : [];
        // The full email is stored encrypted; the masked copy and domain stay readable for stats.
        const fullEmail = typeof body.email === "string" && body.email.length <= 191 && EMAIL_PATTERN.test(body.email) ? body.email.toLowerCase() : null;
        const emailMasked = typeof body.emailMasked === "string" && /^[^@\s]{1,3}•••@[^@\s]{1,191}$/.test(body.emailMasked) ? body.emailMasked : null;
        const emailDomain = (fullEmail ?? emailMasked)?.split("@")[1]?.toLowerCase().slice(0, 191) ?? null;
        await db.breachCheckStat.create({
            data: {
                emailHash,
                emailSealed: fullEmail ? seal(fullEmail) : null,
                emailMasked,
                emailDomain,
                isCompany: emailDomain ? isCompanyDomain(emailDomain) : false,
                breachCount,
                breaches: names,
            },
        });
        const shown = fullEmail ? maskEmail(fullEmail) : emailMasked;
        after(() =>
            alertTelegram(
                "breach_check",
                [
                    `الإيميل: <code>${esc(shown ?? "—")}</code>${emailDomain && isCompanyDomain(emailDomain) ? " · 🏢 إيميل شركة" : ""}`,
                    breachCount === 0 ? "النتيجة: ✅ ما في تسريبات" : `النتيجة: ⚠️ <b>${breachCount}</b> تسريب`,
                    names.length ? `من: ${esc(names.slice(0, 5).join("، "))}${names.length > 5 ? ` و${names.length - 5} غيرهم` : ""}` : null,
                ],
                "/security/emails/checks"
            )
        );
        return NextResponse.json({ ok: true }, { status: 201 });
    }

    const externalId = str(body.id, 64);
    const email = str(body.email, 191)?.toLowerCase() ?? null;
    if (!externalId || !email || !EMAIL_PATTERN.test(email)) return fail(400, "missing id or email");

    // Breach-alert sign-up: goes straight into email monitoring (first check runs on the next cron).
    if (body.kind === "notify") {
        const existing = await db.monitoredEmail.findUnique({ where: { email } });
        if (existing) {
            if (existing.status === "PAUSED") await db.monitoredEmail.update({ where: { id: existing.id }, data: { status: "ACTIVE", nextCheckAt: new Date() } });
            return NextResponse.json({ id: existing.id, duplicate: true });
        }
        const m = await db.monitoredEmail.create({ data: { email, source: str(body.source, 64) ?? "zad.gg/security" } });
        await audit({ actorId: null, action: "email.added", targetType: "monitored_email", targetId: m.id, details: { via: "site" } });
        after(() => alertTelegram("notify", [`الإيميل: <code>${esc(maskEmail(email))}</code>`, "انضاف لمراقبة الإيميلات، وأول فحص بيصير بالدورة الجاية."], `/security/emails/${m.id}`));
        return NextResponse.json({ id: m.id }, { status: 201 });
    }

    let type: ScanType;
    let name: string | null = null;
    let phone: string | null = null;
    let target: string | null = null;
    let authorized = false;

    if (body.kind === "scan") {
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
    after(() =>
        alertTelegram(
            type === "LEAK" ? "scan_leak" : "scan_site",
            [
                `رقم الطلب: <b>#${created.id}</b>`,
                `الاسم: ${esc(name)}`,
                `الموقع: ${esc(target)}`,
                `الهاتف: <code>${esc(phone || "—")}</code>`,
                `الإيميل: <code>${esc(maskEmail(email))}</code>`,
            ],
            `/security/${created.id}`
        )
    );
    return NextResponse.json({ id: created.id }, { status: 201 });
}
