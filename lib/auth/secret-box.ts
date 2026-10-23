import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** AES-256-GCM for secrets stored in the database (TOTP keys). Key derived from AUTH_SECRET. */
function key(): Buffer {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
    }
    return createHash("sha256").update(`zad-admin:secret-box:${secret}`).digest();
}

export function seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(), iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function open(sealed: string): string {
    const [v, iv, tag, data] = sealed.split(".");
    if (v !== "v1") throw new Error("Unknown sealed format");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
