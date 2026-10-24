"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ScanRequest } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection } from "@/lib/auth/permissions";
import { canSeeRequest, isSeverity, isStatus } from "@/lib/requests";
import { checkUpload, deleteUpload, saveUpload } from "@/lib/uploads";

export type ActionState = { ok?: string; error?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function str(form: FormData, key: string, max: number) {
    return String(form.get(key) ?? "").trim().slice(0, max);
}

function refresh(id: number) {
    revalidatePath(`/security/${id}`);
    revalidatePath("/security");
    revalidatePath("/", "layout");
}

/**
 * Loads a request the current user may work on. `open` also requires the file not to be closed.
 * Admins: every request. Staff with the sites permission: only requests assigned to them.
 */
async function loadRequest(form: FormData, opts: { open?: boolean } = {}) {
    const auth = await requireSection("sites");
    const id = Number(form.get("requestId"));
    if (!Number.isInteger(id) || id < 1) return { auth, error: "طلب غير صالح." } as const;
    const r = await db.scanRequest.findUnique({ where: { id } });
    if (!r || !canSeeRequest(auth.user, r)) return { auth, error: "الطلب غير موجود." } as const;
    if (opts.open && r.closedAt) return { auth, error: "الملف مقفل. أعد فتحه أولاً." } as const;
    return { auth, r } as const;
}

const log = (actorId: string, action: string, r: Pick<ScanRequest, "id">, details?: Record<string, string | number>) =>
    audit({ actorId, action, targetType: "scan_request", targetId: String(r.id), details });

// ─── Create (admin) ───────────────────────────────────────────────────

export async function createRequestAction(_prev: ActionState, form: FormData): Promise<ActionState> {
    const { user } = await requireSection("sites");
    if (user.role !== "ADMIN") return { error: "إنشاء الطلبات للمدير فقط." };
    const type = form.get("type") === "LEAK" ? "LEAK" : "SITE";
    let target = str(form, "target", 500);
    const name = str(form, "name", 120);
    const email = str(form, "email", 191).toLowerCase();
    const phone = str(form, "phone", 40) || null;
    const assigneeId = str(form, "assigneeId", 40) || null;
    const due = str(form, "dueAt", 10);
    const note = str(form, "note", 5000);

    if (!target) return { error: "أدخل رابط الموقع." };
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    try {
        new URL(target);
    } catch {
        return { error: "رابط الموقع غير صحيح." };
    }
    if (!name) return { error: "أدخل اسم العميل أو الجهة." };
    if (!EMAIL.test(email)) return { error: "أدخل إيميل العميل." };
    if (due && !DATE.test(due)) return { error: "موعد التسليم غير صحيح." };
    if (assigneeId && !(await db.user.findFirst({ where: { id: assigneeId, isActive: true }, select: { id: true } }))) {
        return { error: "الموظف غير موجود." };
    }

    const r = await db.scanRequest.create({
        data: {
            type,
            target,
            name,
            email,
            phone,
            authorized: form.get("authorized") === "on",
            source: "manual",
            assigneeId,
            dueAt: due ? new Date(`${due}T20:59:59Z`) : null, // end of that day in Amman
            status: assigneeId ? "SCANNING" : "NEW",
        },
    });
    if (note) await db.requestNote.create({ data: { requestId: r.id, authorId: user.id, body: note } });
    await log(user.id, "request.created", r, { assignee: assigneeId ?? "none" });
    redirect(`/security/${r.id}?created=1`);
}

// ─── Status / assignment ──────────────────────────────────────────────

export async function updateStatusAction(form: FormData) {
    const res = await loadRequest(form, { open: true });
    if ("error" in res) return;
    const { auth, r } = res;
    const status = form.get("status");
    if (!isStatus(status) || status === r.status || status === "CLOSED") return;
    await db.scanRequest.update({ where: { id: r.id }, data: { status, statusChangedAt: new Date() } });
    await log(auth.user.id, "request.status_changed", r, { from: r.status, to: status });
    refresh(r.id);
}

/** Admin only: who works on it, and by when. */
export async function assignAction(form: FormData) {
    const res = await loadRequest(form, { open: true });
    if ("error" in res || res.auth.user.role !== "ADMIN") return;
    const { auth, r } = res;
    const assigneeId = str(form, "assigneeId", 40) || null;
    const due = str(form, "dueAt", 10);
    if (assigneeId && !(await db.user.findFirst({ where: { id: assigneeId, isActive: true }, select: { id: true } }))) return;
    const dueAt = due && DATE.test(due) ? new Date(`${due}T20:59:59Z`) : null;

    await db.scanRequest.update({
        where: { id: r.id },
        data: { assigneeId, dueAt, ...(assigneeId && r.status === "NEW" ? { status: "SCANNING", statusChangedAt: new Date() } : {}) },
    });
    if (assigneeId !== r.assigneeId) await log(auth.user.id, "request.assigned", r, { to: assigneeId ?? "none" });
    if (dueAt?.getTime() !== r.dueAt?.getTime()) await log(auth.user.id, "request.due_changed", r, { to: due || "none" });
    refresh(r.id);
}

// ─── Notes ────────────────────────────────────────────────────────────

export async function addNoteAction(form: FormData) {
    const res = await loadRequest(form, { open: true });
    if ("error" in res) return;
    const body = str(form, "body", 5000);
    if (!body) return;
    await db.requestNote.create({ data: { requestId: res.r.id, authorId: res.auth.user.id, body } });
    await log(res.auth.user.id, "request.note_added", res.r);
    refresh(res.r.id);
}

// ─── Findings ─────────────────────────────────────────────────────────

function readFinding(form: FormData) {
    const title = str(form, "title", 200);
    const severity = form.get("severity");
    const description = str(form, "description", 20000);
    if (!title) return { error: "أدخل عنوان الثغرة." } as const;
    if (!isSeverity(severity)) return { error: "اختر درجة الخطورة." } as const;
    if (!description) return { error: "أدخل وصف الثغرة." } as const;
    return {
        data: {
            title,
            severity,
            description,
            affected: str(form, "affected", 500) || null,
            steps: str(form, "steps", 20000) || null,
            recommendation: str(form, "recommendation", 20000) || null,
        },
    } as const;
}

export async function saveFindingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
    const res = await loadRequest(form, { open: true });
    if ("error" in res) return { error: res.error };
    const f = readFinding(form);
    if ("error" in f) return { error: f.error };
    const findingId = str(form, "findingId", 40);
    if (findingId) {
        const existing = await db.finding.findFirst({ where: { id: findingId, requestId: res.r.id } });
        if (!existing) return { error: "الثغرة غير موجودة." };
        await db.finding.update({ where: { id: findingId }, data: f.data });
        await log(res.auth.user.id, "request.finding_updated", res.r, { title: f.data.title });
    } else {
        await db.finding.create({ data: { ...f.data, requestId: res.r.id, authorId: res.auth.user.id } });
        await log(res.auth.user.id, "request.finding_added", res.r, { title: f.data.title, severity: f.data.severity });
    }
    refresh(res.r.id);
    return { ok: findingId ? "تم حفظ التعديل." : "تمت إضافة الثغرة." };
}

export async function toggleFindingAction(form: FormData) {
    const res = await loadRequest(form, { open: true });
    if ("error" in res) return;
    const f = await db.finding.findFirst({ where: { id: str(form, "findingId", 40), requestId: res.r.id } });
    if (!f) return;
    await db.finding.update({ where: { id: f.id }, data: { status: f.status === "OPEN" ? "FIXED" : "OPEN" } });
    await log(res.auth.user.id, "request.finding_updated", res.r, { title: f.title, status: f.status === "OPEN" ? "FIXED" : "OPEN" });
    refresh(res.r.id);
}

export async function deleteFindingAction(form: FormData) {
    const res = await loadRequest(form, { open: true });
    if ("error" in res) return;
    const f = await db.finding.findFirst({ where: { id: str(form, "findingId", 40), requestId: res.r.id } });
    if (!f) return;
    await db.finding.delete({ where: { id: f.id } });
    await log(res.auth.user.id, "request.finding_deleted", res.r, { title: f.title });
    refresh(res.r.id);
}

// ─── Files ────────────────────────────────────────────────────────────

export async function uploadFilesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
    const res = await loadRequest(form, { open: true });
    if ("error" in res) return { error: res.error };
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return { error: "اختر ملفاً واحداً على الأقل." };
    if (files.length > 10) return { error: "الحد الأقصى 10 ملفات في المرة الواحدة." };
    for (const file of files) {
        const c = checkUpload(file);
        if (!c.ok) return { error: c.error };
    }
    for (const file of files) {
        const c = checkUpload(file);
        if (!c.ok) continue;
        const storageKey = await saveUpload(file, c.ext);
        await db.requestFile.create({
            data: { requestId: res.r.id, name: file.name.slice(0, 255), mime: c.mime, size: file.size, storageKey, uploadedById: res.auth.user.id },
        });
        await log(res.auth.user.id, "request.file_uploaded", res.r, { name: file.name.slice(0, 120) });
    }
    refresh(res.r.id);
    return { ok: files.length === 1 ? "تم رفع الملف." : `تم رفع ${files.length} ملفات.` };
}

export async function deleteFileAction(form: FormData) {
    const res = await loadRequest(form, { open: true });
    if ("error" in res) return;
    const file = await db.requestFile.findFirst({ where: { id: str(form, "fileId", 40), requestId: res.r.id } });
    if (!file) return;
    await db.requestFile.delete({ where: { id: file.id } });
    await deleteUpload(file.storageKey);
    await log(res.auth.user.id, "request.file_deleted", res.r, { name: file.name.slice(0, 120) });
    refresh(res.r.id);
}

// ─── Close / reopen ───────────────────────────────────────────────────

export async function closeRequestAction(_prev: ActionState, form: FormData): Promise<ActionState> {
    const res = await loadRequest(form, { open: true });
    if ("error" in res) return { error: res.error };
    const summary = str(form, "summary", 20000);
    if (summary.length < 10) return { error: "اكتب ملخصاً نهائياً للفحص (10 أحرف على الأقل)." };
    const o = form.get("outcome");
    const outcome = o === "CONVERTED" || o === "CLOSED" ? o : "REPORT_SENT";
    await db.scanRequest.update({
        where: { id: res.r.id },
        data: { summary, closedAt: new Date(), closedById: res.auth.user.id, status: outcome, statusChangedAt: new Date() },
    });
    await log(res.auth.user.id, "request.closed", res.r, { outcome });
    refresh(res.r.id);
    return { ok: "تم إقفال الملف." };
}

/** Admin only. */
export async function reopenRequestAction(form: FormData) {
    const res = await loadRequest(form);
    if ("error" in res || res.auth.user.role !== "ADMIN" || !res.r.closedAt) return;
    await db.scanRequest.update({ where: { id: res.r.id }, data: { closedAt: null, closedById: null, status: "SCANNING", statusChangedAt: new Date() } });
    await log(res.auth.user.id, "request.reopened", res.r);
    refresh(res.r.id);
}
