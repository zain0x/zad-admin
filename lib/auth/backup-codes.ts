import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function hashBackupCode(code: string) {
    return createHash("sha256").update(code.toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");
}

/** 8 one-time codes like "k7m2-p9qx", shown once and stored hashed. */
export function generateBackupCodes(count = 8): string[] {
    return Array.from({ length: count }, () => {
        const b = randomBytes(8);
        let s = "";
        for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
        return `${s.slice(0, 4)}-${s.slice(4)}`;
    });
}
