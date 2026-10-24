import { createHmac } from "node:crypto";

/** Same fingerprint the site sends with each check (ADMIN_API_SECRET there = INGEST_SECRET here). */
export function emailFingerprint(email: string): string | null {
    const secret = process.env.INGEST_SECRET;
    return secret ? createHmac("sha256", secret).update(`email:${email.toLowerCase()}`).digest("hex") : null;
}
