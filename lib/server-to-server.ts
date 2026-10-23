import type { NextRequest } from "next/server";
import { verifySignature, type SignatureCheck } from "@/lib/ingest-signature";

/**
 * Checks a call from the zad.gg server: optional IP allow-list, then the HMAC signature
 * with INGEST_SECRET over "<timestamp>.<payload>".
 */
export function checkServerCall(req: NextRequest, payload: string): SignatureCheck | { ok: false; reason: "disabled" | "forbidden" } {
    const secret = process.env.INGEST_SECRET;
    if (!secret || secret.length < 32) return { ok: false, reason: "disabled" };
    const allowed = (process.env.INGEST_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allowed.length) {
        const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
        if (!allowed.includes(ip)) return { ok: false, reason: "forbidden" };
    }
    return verifySignature(secret, req.headers.get("x-zad-timestamp"), req.headers.get("x-zad-signature"), payload);
}
