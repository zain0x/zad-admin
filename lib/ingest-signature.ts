import { createHmac, timingSafeEqual } from "node:crypto";

/** Requests older or newer than this are rejected (stops replaying a captured request). */
export const MAX_SKEW_MS = 5 * 60_000;

export function sign(secret: string, timestamp: string, body: string): string {
    return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing" | "stale" | "mismatch" };

export function verifySignature(
    secret: string,
    timestamp: string | null,
    signature: string | null,
    body: string,
    now = Date.now()
): SignatureCheck {
    if (!timestamp || !signature || !/^\d{10,16}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) {
        return { ok: false, reason: "missing" };
    }
    if (Math.abs(now - Number(timestamp)) > MAX_SKEW_MS) return { ok: false, reason: "stale" };
    const expected = Buffer.from(sign(secret, timestamp, body), "hex");
    const given = Buffer.from(signature, "hex");
    return expected.length === given.length && timingSafeEqual(expected, given)
        ? { ok: true }
        : { ok: false, reason: "mismatch" };
}
