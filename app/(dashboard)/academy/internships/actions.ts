"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection } from "@/lib/auth/permissions";
import { INTERNSHIPS_OPEN, isInternshipStatus, setSetting } from "@/lib/academy";
import { newCertificateCode } from "@/lib/certificates/code";
import type { CertDetails } from "@/lib/certificates/types";

export type InternFormState = { error?: string; ok?: string } | undefined;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (form: FormData, key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);
const appId = (form: FormData) => {
    const n = Number(form.get("applicationId"));
    return Number.isInteger(n) && n > 0 ? n : 0;
};
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

function refresh(id?: number) {
    revalidatePath("/academy/internships");
    if (id) revalidatePath(`/academy/internships/${id}`);
}

export async function toggleInternshipsAction(form: FormData) {
    const { user } = await requireSection("internships");
    const open = form.get("open") === "1";
    await setSetting(INTERNSHIPS_OPEN, open);
    await audit({ actorId: user.id, action: "internship.toggle", details: { open } });
    refresh();
}

export async function updateStatusAction(form: FormData) {
    const { user } = await requireSection("internships");
    const id = appId(form);
    const to = form.get("status");
    if (!id || !isInternshipStatus(to)) return;
    const a = await db.internshipApplication.findUnique({ where: { id }, select: { status: true } });
    if (!a || a.status === to) return;
    await db.internshipApplication.update({ where: { id }, data: { status: to } });
    await audit({ actorId: user.id, action: "internship.status_changed", targetType: "internship", targetId: String(id), details: { from: a.status, to } });
    refresh(id);
}

export async function updateDetailsAction(_prev: InternFormState, form: FormData): Promise<InternFormState> {
    const { user } = await requireSection("internships");
    const id = appId(form);
    if (!id) return { error: "الطلب غير موجود." };
    const startDate = str(form, "startDate", 10);
    const endDate = str(form, "endDate", 10);
    const hoursRaw = str(form, "hours", 6);
    const hours = hoursRaw ? Number(hoursRaw) : null;
    if ((startDate && !DATE.test(startDate)) || (endDate && !DATE.test(endDate))) return { error: "التواريخ غير صحيحة." };
    if (startDate && endDate && startDate > endDate) return { error: "تاريخ البداية بعد تاريخ النهاية." };
    if (hours !== null && (!Number.isInteger(hours) || hours < 1 || hours > 5000)) return { error: "عدد الساعات غير صحيح." };
    const nameEn = str(form, "nameEn", 160).replace(/\s+/g, " ");
    if (nameEn && !/^[A-Za-z][A-Za-z .'\-]*$/.test(nameEn)) return { error: "الاسم بالإنجليزي لازم يكون بأحرف إنجليزية." };
    const gender = form.get("gender") === "FEMALE" ? "FEMALE" : "MALE";
    const supervisorId = str(form, "supervisorId", 40) || null;
    if (supervisorId && !(await db.user.findFirst({ where: { id: supervisorId, isActive: true }, select: { id: true } }))) return { error: "المشرف غير موجود." };

    await db.internshipApplication.update({
        where: { id },
        data: {
            nameEn,
            gender,
            supervisorId,
            department: str(form, "department", 120) || null,
            startDate: startDate ? new Date(`${startDate}T00:00:00Z`) : null,
            endDate: endDate ? new Date(`${endDate}T00:00:00Z`) : null,
            hours,
        },
    });
    await audit({ actorId: user.id, action: "internship.updated", targetType: "internship", targetId: String(id) });
    refresh(id);
    return { ok: "تم الحفظ." };
}

export async function addNoteAction(_prev: InternFormState, form: FormData): Promise<InternFormState> {
    const { user } = await requireSection("internships");
    const id = appId(form);
    const body = str(form, "body", 5000);
    if (!id || !body) return { error: "اكتب الملاحظة." };
    await db.internshipNote.create({ data: { applicationId: id, authorId: user.id, body } });
    await audit({ actorId: user.id, action: "internship.note_added", targetType: "internship", targetId: String(id) });
    refresh(id);
    return { ok: "تمت الإضافة." };
}

/** Turns a finished internship into an INTERNSHIP certificate, reusing the stored dates and department. */
export async function issueInternCertificateAction(_prev: InternFormState, form: FormData): Promise<InternFormState> {
    const { user } = await requireSection("internships");
    const id = appId(form);
    const a = await db.internshipApplication.findUnique({ where: { id } });
    if (!a) return { error: "الطلب غير موجود." };
    if (a.certificateId) return { error: "تم إصدار شهادة لهذا الطلب مسبقاً." };
    if (a.status !== "COMPLETED") return { error: "غيّر الحالة لـ «أنهى التدريب» أولاً." };
    if (!a.nameEn || !/^[A-Za-z][A-Za-z .'\-]*$/.test(a.nameEn)) return { error: "أضف الاسم بالإنجليزي من «بيانات التدريب» (يُطبع على الشهادة)." };
    if (!a.department || !a.startDate || !a.endDate) return { error: "أكمل القسم وتاريخ البداية والنهاية قبل الإصدار." };

    const skills = str(form, "skills", 600)
        .split(/[,،\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6);
    const details: CertDetails = { departmentAr: a.department, startDate: isoDay(a.startDate), endDate: isoDay(a.endDate), skills };
    const issuedAt = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);

    const cert = await db.$transaction(async (tx) => {
        const c = await tx.certificate.create({
            data: {
                code: await newCertificateCode(issuedAt.getUTCFullYear()),
                type: "INTERNSHIP",
                nameAr: a.nameAr,
                nameEn: a.nameEn.replace(/\s+/g, " ").trim(),
                gender: a.gender,
                email: a.email,
                details: details as Prisma.InputJsonValue,
                issuedAt,
                issuedById: user.id,
            },
        });
        await tx.internshipApplication.update({ where: { id }, data: { certificateId: c.id } });
        return c;
    });
    await audit({ actorId: user.id, action: "cert.issued", targetType: "certificate", targetId: cert.id, details: { code: cert.code, type: cert.type } });
    await audit({ actorId: user.id, action: "internship.certificate_issued", targetType: "internship", targetId: String(id), details: { code: cert.code } });
    refresh(id);
    revalidatePath("/certificates");
    redirect(`/academy/internships/${id}?issued=1`);
}
