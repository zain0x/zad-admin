"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CertificateType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection } from "@/lib/auth/permissions";
import { newBatchId, newCertificateCode } from "@/lib/certificates/code";
import { readPeople } from "@/lib/certificates/csv";
import { isCertType, parseDetails, parsePerson, type CertDetails } from "@/lib/certificates/types";

export type CertFormState = { error?: string } | undefined;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function issuedDate(form: FormData): Date | null {
    const v = String(form.get("issuedAt") ?? "");
    return DATE.test(v) ? new Date(`${v}T00:00:00Z`) : null;
}

function readForm(form: FormData) {
    const type = form.get("type");
    if (!isCertType(type)) return { error: "اختر نوع الشهادة." } as const;
    const person = parsePerson({
        nameAr: String(form.get("nameAr") ?? ""),
        nameEn: String(form.get("nameEn") ?? ""),
        gender: String(form.get("gender") ?? ""),
        email: String(form.get("email") ?? ""),
    });
    if (!person.ok) return { error: person.error } as const;
    const d = parseDetails(type, form);
    if ("error" in d) return { error: d.error } as const;
    const issuedAt = issuedDate(form);
    if (!issuedAt) return { error: "أدخل تاريخ الإصدار." } as const;
    return { type, person, details: d.details, issuedAt } as const;
}

export async function issueCertificateAction(_prev: CertFormState, form: FormData): Promise<CertFormState> {
    const { user } = await requireSection("certificates");
    const r = readForm(form);
    if ("error" in r) return { error: r.error };

    const cert = await db.certificate.create({
        data: {
            code: await newCertificateCode(r.issuedAt.getUTCFullYear()),
            type: r.type,
            nameAr: r.person.nameAr,
            nameEn: r.person.nameEn,
            gender: r.person.gender,
            email: r.person.email,
            details: r.details as Prisma.InputJsonValue,
            issuedAt: r.issuedAt,
            issuedById: user.id,
        },
    });
    await audit({ actorId: user.id, action: "cert.issued", targetType: "certificate", targetId: cert.id, details: { code: cert.code, type: cert.type } });
    revalidatePath("/certificates");
    redirect(`/certificates/${cert.id}?issued=1`);
}

export async function updateCertificateAction(_prev: CertFormState, form: FormData): Promise<CertFormState> {
    const { user } = await requireSection("certificates");
    const id = String(form.get("id") ?? "");
    const current = await db.certificate.findUnique({ where: { id } });
    if (!current) return { error: "الشهادة غير موجودة." };
    const r = readForm(form);
    if ("error" in r) return { error: r.error };

    await db.certificate.update({
        where: { id },
        data: {
            type: r.type,
            nameAr: r.person.nameAr,
            nameEn: r.person.nameEn,
            gender: r.person.gender,
            email: r.person.email,
            details: r.details as Prisma.InputJsonValue,
            issuedAt: r.issuedAt,
        },
    });
    await audit({
        actorId: user.id,
        action: "cert.updated",
        targetType: "certificate",
        targetId: id,
        details: { code: current.code, before: `${current.nameEn} / ${current.nameAr}` },
    });
    revalidatePath(`/certificates/${id}`);
    revalidatePath("/certificates");
    redirect(`/certificates/${id}?updated=1`);
}

export async function revokeCertificateAction(form: FormData) {
    const { user } = await requireSection("certificates");
    const id = String(form.get("id") ?? "");
    const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
    const cert = await db.certificate.findUnique({ where: { id } });
    if (!cert || cert.status === "REVOKED") return;
    await db.certificate.update({
        where: { id },
        data: { status: "REVOKED", revokedAt: new Date(), revokedById: user.id, revokeReason: reason || null },
    });
    await audit({ actorId: user.id, action: "cert.revoked", targetType: "certificate", targetId: id, details: { code: cert.code, reason } });
    revalidatePath(`/certificates/${id}`);
    revalidatePath("/certificates");
}

export async function restoreCertificateAction(form: FormData) {
    const { user } = await requireSection("certificates");
    const id = String(form.get("id") ?? "");
    const cert = await db.certificate.findUnique({ where: { id } });
    if (!cert || cert.status === "ACTIVE") return;
    await db.certificate.update({ where: { id }, data: { status: "ACTIVE", revokedAt: null, revokedById: null, revokeReason: null } });
    await audit({ actorId: user.id, action: "cert.restored", targetType: "certificate", targetId: id, details: { code: cert.code } });
    revalidatePath(`/certificates/${id}`);
    revalidatePath("/certificates");
}

// ─── Bulk issue from CSV ───────────────────────────────────────────────

export type BulkRow = { line: number; nameAr: string; nameEn: string; gender: string; email: string; error?: string };
export type BulkState =
    | {
          error?: string;
          preview?: { type: CertificateType; details: CertDetails; issuedAt: string; rows: BulkRow[]; fields: Record<string, string> };
      }
    | undefined;

const SHARED_FIELDS = ["type", "issuedAt", "titleAr", "titleEn", "date", "hours", "departmentAr", "departmentEn", "startDate", "endDate", "skills"];

/** Step 1: read the file and show what will be issued. Nothing is saved yet. */
export async function previewBulkAction(_prev: BulkState, form: FormData): Promise<BulkState> {
    await requireSection("certificates");
    const type = form.get("type");
    if (!isCertType(type)) return { error: "اختر نوع الشهادة." };
    const d = parseDetails(type, form);
    if ("error" in d) return { error: d.error };
    const issuedAt = issuedDate(form);
    if (!issuedAt) return { error: "أدخل تاريخ الإصدار." };

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "اختر ملف CSV." };
    if (file.size > 1024 * 1024) return { error: "الملف أكبر من 1 ميجا." };
    const parsed = readPeople(await file.text());
    if ("error" in parsed) return { error: parsed.error };

    const rows: BulkRow[] = parsed.people.map((p) => {
        const r = parsePerson(p);
        return { ...p, error: r.ok ? undefined : r.error };
    });
    const fields = Object.fromEntries(SHARED_FIELDS.map((k) => [k, String(form.get(k) ?? "")]));
    return { preview: { type, details: d.details, issuedAt: fields.issuedAt, rows, fields } };
}

/** Step 2: issue one certificate per valid row. Everything is validated again here. */
export async function issueBulkAction(_prev: BulkState, form: FormData): Promise<BulkState> {
    const { user } = await requireSection("certificates");
    const type = form.get("type");
    if (!isCertType(type)) return { error: "اختر نوع الشهادة." };
    const d = parseDetails(type, form);
    if ("error" in d) return { error: d.error };
    const issuedAt = issuedDate(form);
    if (!issuedAt) return { error: "أدخل تاريخ الإصدار." };

    let people: { nameAr: string; nameEn: string; gender: string; email: string }[];
    try {
        people = JSON.parse(String(form.get("people") ?? "[]"));
    } catch {
        return { error: "بيانات غير صالحة، أعد رفع الملف." };
    }
    const valid = people.map((p) => parsePerson(p)).filter((r) => r.ok);
    if (!valid.length) return { error: "لا يوجد أشخاص صالحون للإصدار." };
    if (valid.length > 500) return { error: "الحد الأقصى 500 شخص." };

    const batchId = newBatchId();
    for (const p of valid) {
        if (!p.ok) continue;
        await db.certificate.create({
            data: {
                code: await newCertificateCode(issuedAt.getUTCFullYear()),
                type,
                nameAr: p.nameAr,
                nameEn: p.nameEn,
                gender: p.gender,
                email: p.email,
                details: d.details as Prisma.InputJsonValue,
                issuedAt,
                batchId,
                issuedById: user.id,
            },
        });
    }
    await audit({ actorId: user.id, action: "cert.bulk_issued", targetType: "batch", targetId: batchId, details: { type, count: valid.length } });
    revalidatePath("/certificates");
    redirect(`/certificates?batch=${batchId}`);
}
