"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { requireSection } from "@/lib/auth/permissions";
import { checkMonitoredEmail, nextCheckFrom, runDueChecks } from "@/lib/breach/monitor";

export type EmailFormState = { ok?: string; error?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refresh(id?: string) {
    revalidatePath("/security/emails");
    if (id) revalidatePath(`/security/emails/${id}`);
}

export async function addEmailsAction(_prev: EmailFormState, form: FormData): Promise<EmailFormState> {
    const { user } = await requireSection("emails");
    const frequency = form.get("frequency") === "MONTHLY" ? "MONTHLY" : "WEEKLY";
    const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
    const list = String(form.get("emails") ?? "")
        .split(/[\s,;،]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    if (!list.length) return { error: "أدخل إيميلاً واحداً على الأقل." };
    if (list.length > 200) return { error: "الحد الأقصى 200 إيميل في المرة الواحدة." };
    const invalid = list.filter((e) => !EMAIL.test(e) || e.length > 191);
    if (invalid.length) return { error: `إيميلات غير صحيحة: ${invalid.slice(0, 5).join("، ")}` };

    const unique = [...new Set(list)];
    const existing = new Set((await db.monitoredEmail.findMany({ where: { email: { in: unique } }, select: { email: true } })).map((e) => e.email));
    const fresh = unique.filter((e) => !existing.has(e));
    if (fresh.length) {
        await db.monitoredEmail.createMany({ data: fresh.map((email) => ({ email, frequency, note, source: "manual", addedById: user.id })) });
        await audit({ actorId: user.id, action: "email.added", details: { count: fresh.length, frequency } });
    }
    refresh();
    const skipped = unique.length - fresh.length;
    return { ok: `أُضيف ${fresh.length} إيميل للمراقبة${skipped ? `، و${skipped} موجود من قبل` : ""}. أول فحص يتم مع الفحص الدوري القادم، أو اضغط "افحص المستحق الآن".` };
}

export async function updateEmailAction(form: FormData) {
    const { user } = await requireSection("emails");
    const id = String(form.get("id") ?? "");
    const m = await db.monitoredEmail.findUnique({ where: { id } });
    if (!m) return;
    const frequency = form.get("frequency") === "MONTHLY" ? "MONTHLY" : "WEEKLY";
    const status = form.get("status") === "PAUSED" ? "PAUSED" : "ACTIVE";
    const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
    await db.monitoredEmail.update({
        where: { id },
        data: {
            frequency,
            status,
            note,
            // A new frequency applies from the last check; resuming makes the email due now.
            ...(frequency !== m.frequency && m.lastCheckedAt ? { nextCheckAt: nextCheckFrom(frequency, m.lastCheckedAt) } : {}),
            ...(status === "ACTIVE" && m.status === "PAUSED" ? { nextCheckAt: new Date() } : {}),
        },
    });
    await audit({ actorId: user.id, action: "email.updated", targetType: "monitored_email", targetId: id, details: { email: m.email, frequency, status } });
    refresh(id);
}

export async function checkNowAction(form: FormData) {
    const { user } = await requireSection("emails");
    const id = String(form.get("id") ?? "");
    const m = await db.monitoredEmail.findUnique({ where: { id } });
    if (!m) return;
    await checkMonitoredEmail(m);
    await audit({ actorId: user.id, action: "email.checked", targetType: "monitored_email", targetId: id, details: { email: m.email } });
    refresh(id);
}

export async function markReviewedAction(form: FormData) {
    const { user } = await requireSection("emails");
    const id = String(form.get("id") ?? "");
    const m = await db.monitoredEmail.findUnique({ where: { id }, select: { email: true, hasNewBreach: true } });
    if (!m?.hasNewBreach) return;
    await db.monitoredEmail.update({ where: { id }, data: { hasNewBreach: false } });
    await audit({ actorId: user.id, action: "email.reviewed", targetType: "monitored_email", targetId: id, details: { email: m.email } });
    refresh(id);
}

export async function removeEmailAction(form: FormData) {
    const { user } = await requireSection("emails");
    const id = String(form.get("id") ?? "");
    const m = await db.monitoredEmail.findUnique({ where: { id }, select: { email: true } });
    if (!m) return;
    await db.monitoredEmail.delete({ where: { id } });
    await audit({ actorId: user.id, action: "email.removed", targetType: "monitored_email", targetId: id, details: { email: m.email } });
    refresh();
    redirect("/security/emails?removed=1");
}

export type RunState = { ok?: string; error?: string } | undefined;

export async function runDueAction(_prev: RunState): Promise<RunState> {
    const { user } = await requireAdmin();
    const r = await runDueChecks(20);
    if (r.skipped) return { error: "فحص آخر شغّال الآن، جرّب بعد دقيقة." };
    await audit({ actorId: user.id, action: "email.monitor_run", details: { ...r, via: "button" } });
    refresh();
    if (!r.checked) return { ok: "لا يوجد إيميلات مستحقة للفحص الآن." };
    return { ok: `تم فحص ${r.checked} إيميل: ${r.newAlerts} فيها تسريب جديد${r.failed ? `، و${r.failed} تعذّر فحصها` : ""}.` };
}

/** Moves breach-alert sign-ups stored as requests before email monitoring existed. */
export async function importOldSignupsAction() {
    const { user } = await requireAdmin();
    const old: { email: string; createdAt: Date }[] = await db.scanRequest.findMany({ where: { type: "NOTIFY" }, select: { email: true, createdAt: true } });
    const existing = new Set((await db.monitoredEmail.findMany({ select: { email: true } })).map((e) => e.email));
    const fresh = [...new Map(old.filter((o) => !existing.has(o.email)).map((o) => [o.email, o])).values()];
    if (fresh.length) {
        await db.monitoredEmail.createMany({ data: fresh.map((o) => ({ email: o.email, source: "zad.gg/security", createdAt: o.createdAt })) });
    }
    await db.scanRequest.updateMany({ where: { type: "NOTIFY" }, data: { status: "CLOSED" } });
    await audit({ actorId: user.id, action: "email.imported", details: { count: fresh.length } });
    refresh();
}
