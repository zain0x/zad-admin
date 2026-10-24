import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Attachments live on disk outside public/, and are only served through an authenticated route. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    html: "text/plain", // served as text, never rendered
    xml: "text/plain",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
};

export const ACCEPT_ATTR = Object.keys(ALLOWED).map((e) => `.${e}`).join(",");

function dir() {
    return process.env.UPLOADS_DIR || path.join(process.cwd(), "storage", "uploads");
}

export function checkUpload(file: File): { ok: true; ext: string; mime: string } | { ok: false; error: string } {
    if (!file.size) return { ok: false, error: `الملف ${file.name} فارغ.` };
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: `الملف ${file.name} أكبر من 20 ميجا.` };
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED[ext]) return { ok: false, error: `نوع الملف ${file.name} غير مسموح.` };
    return { ok: true, ext, mime: ALLOWED[ext] };
}

/** Saves under a random name; the original name is only kept in the database. */
export async function saveUpload(file: File, ext: string): Promise<string> {
    await mkdir(dir(), { recursive: true });
    const key = `${randomBytes(16).toString("hex")}.${ext}`;
    await writeFile(path.join(dir(), key), Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
    return key;
}

/** Same as saveUpload, for bytes that did not come from a form (e.g. a CV forwarded by zad.gg). */
export async function saveUploadBytes(data: Buffer, ext: string): Promise<string> {
    await mkdir(dir(), { recursive: true });
    const key = `${randomBytes(16).toString("hex")}.${ext}`;
    await writeFile(path.join(dir(), key), data, { mode: 0o600 });
    return key;
}

function safePath(key: string) {
    if (!/^[0-9a-f]{32}\.[a-z0-9]{1,5}$/.test(key)) throw new Error("bad storage key");
    return path.join(dir(), key);
}

export function readUpload(key: string) {
    return readFile(safePath(key));
}

export async function deleteUpload(key: string) {
    await unlink(safePath(key)).catch(() => {});
}

export function formatBytes(n: number) {
    return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
