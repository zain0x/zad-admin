import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

// No 0/O/1/I/L so a number read aloud or typed by hand is not mistaken.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomPart(len = 6) {
    const b = randomBytes(len);
    let s = "";
    for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
    return s;
}

/** ZAD-2026-8K3F9Q: unique, not guessable (31^6 ≈ 900 million per year). */
export async function newCertificateCode(year = new Date().getUTCFullYear()): Promise<string> {
    for (let i = 0; i < 8; i++) {
        const code = `ZAD-${year}-${randomPart()}`;
        if (!(await db.certificate.findUnique({ where: { code }, select: { id: true } }))) return code;
    }
    throw new Error("Could not generate a unique certificate code");
}

export function newBatchId() {
    return `B${Date.now().toString(36).toUpperCase()}${randomPart(4)}`;
}

export function normaliseCode(input: string) {
    return input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
}
