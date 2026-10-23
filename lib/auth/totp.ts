import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), compatible with Google Authenticator, Authy, 1Password. */
const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = "";
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += B32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
}

export function base32Decode(input: string): Buffer {
    const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        value = (value << 5) | B32.indexOf(ch);
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

export function generateTotpSecret(): string {
    return base32Encode(randomBytes(20));
}

export function currentStep(now = Date.now()): number {
    return Math.floor(now / 1000 / STEP_SECONDS);
}

export function totpAt(secret: string, step: number): string {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 15;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
    return code.toString().padStart(DIGITS, "0");
}

/**
 * Checks a code against the current step ±1 (clock drift).
 * Returns the matched step, or null. Callers must reject steps <= the last one used (replay).
 */
export function verifyTotp(secret: string, code: string, lastUsedStep: number | null, now = Date.now()): number | null {
    const clean = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(clean)) return null;
    const step = currentStep(now);
    for (const s of [step - 1, step, step + 1]) {
        if (lastUsedStep !== null && s <= lastUsedStep) continue;
        const expected = Buffer.from(totpAt(secret, s));
        if (timingSafeEqual(expected, Buffer.from(clean))) return s;
    }
    return null;
}

export function totpUri(secret: string, account: string, issuer = "Zad Admin"): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
