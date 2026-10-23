"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { isStatus } from "@/lib/requests";

function requestId(form: FormData) {
    const id = Number(form.get("requestId"));
    return Number.isInteger(id) && id > 0 ? id : null;
}

function refresh(id: number) {
    revalidatePath(`/security/${id}`);
    revalidatePath("/security");
    revalidatePath("/");
}

export async function updateStatusAction(form: FormData) {
    const { user } = await requireUser();
    const id = requestId(form);
    const status = form.get("status");
    if (!id || !isStatus(status)) return;
    const current = await db.scanRequest.findUnique({ where: { id }, select: { status: true, assigneeId: true } });
    if (!current || current.status === status) return;

    await db.scanRequest.update({
        where: { id },
        // Whoever moves a new request forward takes it, unless someone already has it.
        data: { status, statusChangedAt: new Date(), ...(current.assigneeId ? {} : { assigneeId: user.id }) },
    });
    await audit({ actorId: user.id, action: "request.status_changed", targetType: "scan_request", targetId: String(id), details: { from: current.status, to: status } });
    refresh(id);
}

export async function assignAction(form: FormData) {
    const { user } = await requireUser();
    const id = requestId(form);
    if (!id) return;
    const raw = String(form.get("assigneeId") ?? "");
    const assigneeId = raw === "me" ? user.id : raw || null;
    if (assigneeId) {
        const ok = await db.user.findFirst({ where: { id: assigneeId, isActive: true }, select: { id: true } });
        if (!ok) return;
    }
    const current = await db.scanRequest.findUnique({ where: { id }, select: { assigneeId: true } });
    if (!current || current.assigneeId === assigneeId) return;

    await db.scanRequest.update({ where: { id }, data: { assigneeId } });
    await audit({ actorId: user.id, action: "request.assigned", targetType: "scan_request", targetId: String(id), details: { to: assigneeId ?? "none" } });
    refresh(id);
}

export async function addNoteAction(form: FormData) {
    const { user } = await requireUser();
    const id = requestId(form);
    const body = String(form.get("body") ?? "").trim();
    if (!id || !body || body.length > 5000) return;
    if (!(await db.scanRequest.findUnique({ where: { id }, select: { id: true } }))) return;

    await db.requestNote.create({ data: { requestId: id, authorId: user.id, body } });
    await audit({ actorId: user.id, action: "request.note_added", targetType: "scan_request", targetId: String(id) });
    refresh(id);
}
