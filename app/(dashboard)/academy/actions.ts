"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LectureMode, LectureStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection } from "@/lib/auth/permissions";
import { fromAmmanLocal } from "@/lib/academy";
import { checkUpload, deleteUpload, saveUpload } from "@/lib/uploads";

export type LectureFormState = { error?: string } | undefined;

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp"]);
const MAX_IMAGE = 5 * 1024 * 1024;

function str(form: FormData, key: string, max: number) {
    return String(form.get(key) ?? "").trim().slice(0, max);
}

async function readLecture(form: FormData) {
    const titleAr = str(form, "titleAr", 200);
    const startsAt = fromAmmanLocal(str(form, "startsAt", 16));
    const durationMinutes = Math.round(Number(str(form, "durationHours", 6)) * 60);
    const capacity = Number(str(form, "capacity", 6));
    const mode: LectureMode = form.get("mode") === "ONLINE" ? "ONLINE" : "IN_PERSON";
    const deadlineRaw = str(form, "registrationDeadline", 16);
    const registrationDeadline = deadlineRaw ? fromAmmanLocal(deadlineRaw) : null;
    const s = form.get("status");
    const status: LectureStatus = s === "PUBLISHED" || s === "CLOSED" ? s : "DRAFT";
    let onlineUrl = str(form, "onlineUrl", 500) || null;

    if (!titleAr) return { error: "أدخل عنوان المحاضرة." } as const;
    if (!startsAt) return { error: "أدخل تاريخ ووقت المحاضرة." } as const;
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 24 * 60) return { error: "المدة بين ربع ساعة و24 ساعة." } as const;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return { error: "عدد المقاعد غير صحيح." } as const;
    if (deadlineRaw && !registrationDeadline) return { error: "آخر موعد للتسجيل غير صحيح." } as const;
    if (registrationDeadline && registrationDeadline > startsAt) return { error: "آخر موعد للتسجيل لازم يكون قبل المحاضرة." } as const;
    if (onlineUrl && !/^https?:\/\//i.test(onlineUrl)) onlineUrl = `https://${onlineUrl}`;

    const image = form.get("image");
    let imageFile: { file: File; ext: string } | null = null;
    if (image instanceof File && image.size > 0) {
        const c = checkUpload(image);
        if (!c.ok || !IMAGE_EXT.has(c.ext)) return { error: "الصورة لازم تكون JPG أو PNG أو WebP." } as const;
        if (image.size > MAX_IMAGE) return { error: "الصورة أكبر من 5 ميجا." } as const;
        imageFile = { file: image, ext: c.ext };
    }

    return {
        data: {
            titleAr,
            titleEn: str(form, "titleEn", 200) || null,
            speaker: str(form, "speaker", 160) || null,
            description: str(form, "description", 5000) || null,
            startsAt,
            durationMinutes,
            mode,
            location: mode === "IN_PERSON" ? str(form, "location", 300) || null : null,
            onlineUrl: mode === "ONLINE" ? onlineUrl : null,
            capacity,
            registrationDeadline,
            status,
        },
        imageFile,
    } as const;
}

function refresh(id?: string) {
    revalidatePath("/academy");
    if (id) revalidatePath(`/academy/${id}`);
}

export async function createLectureAction(_prev: LectureFormState, form: FormData): Promise<LectureFormState> {
    const { user } = await requireSection("lectures");
    const r = await readLecture(form);
    if ("error" in r) return { error: r.error };
    const imageKey = r.imageFile ? await saveUpload(r.imageFile.file, r.imageFile.ext) : null;
    const l = await db.lecture.create({ data: { ...r.data, imageKey, createdById: user.id } });
    await audit({ actorId: user.id, action: "lecture.created", targetType: "lecture", targetId: l.id, details: { title: l.titleAr } });
    refresh();
    redirect(`/academy/${l.id}?created=1`);
}

export async function updateLectureAction(_prev: LectureFormState, form: FormData): Promise<LectureFormState> {
    const { user } = await requireSection("lectures");
    const id = str(form, "id", 40);
    const current = await db.lecture.findUnique({ where: { id }, include: { _count: { select: { registrations: { where: { status: "CONFIRMED" } } } } } });
    if (!current) return { error: "المحاضرة غير موجودة." };
    const r = await readLecture(form);
    if ("error" in r) return { error: r.error };
    if (r.data.capacity < current._count.registrations) {
        return { error: `في ${current._count.registrations} مسجّل، ما بصير المقاعد أقل من هيك.` };
    }
    let imageKey = current.imageKey;
    if (r.imageFile) {
        imageKey = await saveUpload(r.imageFile.file, r.imageFile.ext);
        if (current.imageKey) await deleteUpload(current.imageKey);
    } else if (form.get("removeImage") === "on" && current.imageKey) {
        await deleteUpload(current.imageKey);
        imageKey = null;
    }
    await db.lecture.update({ where: { id }, data: { ...r.data, imageKey } });
    await audit({ actorId: user.id, action: "lecture.updated", targetType: "lecture", targetId: id, details: { title: r.data.titleAr, status: r.data.status } });
    refresh(id);
    redirect(`/academy/${id}?saved=1`);
}

export async function cancelRegistrationAction(form: FormData) {
    const { user } = await requireSection("lectures");
    const reg = await db.lectureRegistration.findUnique({ where: { id: str(form, "registrationId", 40) } });
    if (!reg || reg.status === "CANCELLED") return;
    await db.lectureRegistration.update({ where: { id: reg.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await audit({ actorId: user.id, action: "lecture.registration_cancelled", targetType: "lecture", targetId: reg.lectureId, details: { email: reg.email, code: reg.code } });
    refresh(reg.lectureId);
}

export async function toggleAttendedAction(form: FormData) {
    await requireSection("lectures");
    const reg = await db.lectureRegistration.findUnique({ where: { id: str(form, "registrationId", 40) } });
    if (!reg || reg.status !== "CONFIRMED") return;
    await db.lectureRegistration.update({ where: { id: reg.id }, data: { attended: !reg.attended } });
    refresh(reg.lectureId);
}

/** Quick switch from the lecture page: mark the lecture full (registration closed) or reopen it. */
export async function toggleLectureFullAction(form: FormData) {
    const { user } = await requireSection("lectures");
    const id = str(form, "id", 40);
    const l = await db.lecture.findUnique({ where: { id }, select: { status: true, titleAr: true } });
    if (!l || l.status === "DRAFT") return;
    const status: LectureStatus = l.status === "CLOSED" ? "PUBLISHED" : "CLOSED";
    await db.lecture.update({ where: { id }, data: { status } });
    await audit({ actorId: user.id, action: "lecture.updated", targetType: "lecture", targetId: id, details: { title: l.titleAr, status } });
    refresh(id);
}

export async function deleteLectureAction(form: FormData) {
    const { user } = await requireSection("lectures");
    const id = str(form, "id", 40);
    const l = await db.lecture.findUnique({ where: { id }, include: { _count: { select: { registrations: true } } } });
    if (!l) return;
    await db.lecture.delete({ where: { id } });
    if (l.imageKey) await deleteUpload(l.imageKey);
    await audit({ actorId: user.id, action: "lecture.deleted", targetType: "lecture", targetId: id, details: { title: l.titleAr, registrations: l._count.registrations } });
    refresh();
    redirect("/academy?deleted=1");
}
