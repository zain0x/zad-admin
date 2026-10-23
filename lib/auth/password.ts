import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node, no native dependency).
 * Stored format: scrypt$N$r$p$<salt base64>$<hash base64>
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number) {
    return new Promise<Buffer>((resolve, reject) => {
        scryptCb(password.normalize("NFKC"), salt, KEY_LEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
            err ? reject(err) : resolve(key)
        );
    });
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, N, R, P);
    return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A hash of a random password, used to spend the same time when the email does not exist. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
    dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
    return dummyHash;
}

export const PASSWORD_MIN_LENGTH = 12;

/** Readable temporary password: no 0/O/1/l/I, grouped for dictation. */
export function generateTempPassword(): string {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const bytes = randomBytes(16);
    let out = "";
    for (let i = 0; i < 16; i++) {
        out += alphabet[bytes[i] % alphabet.length];
        if (i % 4 === 3 && i < 15) out += "-";
    }
    return out;
}
