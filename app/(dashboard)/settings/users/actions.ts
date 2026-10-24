"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { SECTIONS } from "@/lib/auth/permissions";

function readPerms(form: FormData) {
    return Object.fromEntries(SECTIONS.map((s) => [s.field, form.get(s.field) === "on"])) as Record<(typeof SECTIONS)[number]["field"], boolean>;
}

export type ManageState = { ok?: string; error?: string; tempPassword?: string; email?: string } | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = ["ADMIN", "STAFF"];

/** Is there an active admin other than this user? Keeps the panel from locking itself out. */
async function anotherActiveAdmin(userId: string) {
    return (await db.user.count({ where: { role: "ADMIN", isActive: true, id: { not: userId } } })) > 0;
}

export async function createUserAction(_prev: ManageState, form: FormData): Promise<ManageState> {
    const { user: actor } = await requireAdmin();
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const role = String(form.get("role") ?? "STAFF") as Role;

    if (name.length < 2 || name.length > 120) return { error: "أدخل اسماً صحيحاً." };
    if (!EMAIL_PATTERN.test(email) || email.length > 191) return { error: "أدخل بريداً إلكترونياً صحيحاً." };
    if (!ROLES.includes(role)) return { error: "دور غير معروف." };
    if (await db.user.findUnique({ where: { email } })) return { error: "يوجد حساب بهذا البريد." };

    const tempPassword = generateTempPassword();
    const perms = readPerms(form);
    const created = await db.user.create({
        data: { name, email, role, passwordHash: await hashPassword(tempPassword), mustChangePassword: true, ...perms },
    });
    await audit({
        actorId: actor.id,
        action: "user.created",
        targetType: "user",
        targetId: created.id,
        details: { email, role, sections: SECTIONS.filter((x) => perms[x.field]).map((x) => x.key).join(",") || "none" },
    });
    revalidatePath("/settings/users");
    return { ok: `تمت إضافة ${name}.`, tempPassword, email };
}

export async function manageUserAction(_prev: ManageState, form: FormData): Promise<ManageState> {
    const { user: actor } = await requireAdmin();
    const intent = String(form.get("intent") ?? "");
    const targetId = String(form.get("userId") ?? "");
    const target = await db.user.findUnique({ where: { id: targetId } });
    if (!target) return { error: "الحساب غير موجود." };
    if (target.id === actor.id) return { error: "لا يمكنك تنفيذ هذا الإجراء على حسابك." };

    const log = (action: string, details?: Record<string, string>) =>
        audit({ actorId: actor.id, action, targetType: "user", targetId: target.id, details: { email: target.email, ...details } });

    switch (intent) {
        case "perms": {
            const perms = readPerms(form);
            await db.user.update({ where: { id: target.id }, data: perms });
            await log("user.permissions_changed", { sections: SECTIONS.filter((x) => perms[x.field]).map((x) => x.key).join(",") || "none" });
            revalidatePath("/settings/users");
            return { ok: "تم حفظ الصلاحيات." };
        }
        case "role": {
            const role: Role = target.role === "ADMIN" ? "STAFF" : "ADMIN";
            if (target.role === "ADMIN" && !(await anotherActiveAdmin(target.id))) {
                return { error: "يجب أن يبقى مدير نشط واحد على الأقل." };
            }
            await db.user.update({ where: { id: target.id }, data: { role } });
            await log("user.role_changed", { from: target.role, to: role });
            revalidatePath("/settings/users");
            return { ok: role === "ADMIN" ? "أصبح مديراً." : "أصبح موظفاً." };
        }
        case "toggle": {
            if (target.isActive && target.role === "ADMIN" && !(await anotherActiveAdmin(target.id))) {
                return { error: "يجب أن يبقى مدير نشط واحد على الأقل." };
            }
            await db.$transaction([
                db.user.update({ where: { id: target.id }, data: { isActive: !target.isActive } }),
                ...(target.isActive ? [db.session.deleteMany({ where: { userId: target.id } })] : []),
            ]);
            await log(target.isActive ? "user.deactivated" : "user.activated");
            revalidatePath("/settings/users");
            return { ok: target.isActive ? "تم تعطيل الحساب وتسجيل خروجه." : "تم تفعيل الحساب." };
        }
        case "reset2fa": {
            await db.$transaction([
                db.user.update({
                    where: { id: target.id },
                    data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null },
                }),
                db.backupCode.deleteMany({ where: { userId: target.id } }),
                db.session.deleteMany({ where: { userId: target.id } }),
            ]);
            await log("user.2fa_reset");
            revalidatePath("/settings/users");
            return { ok: "سيُطلب منه إعداد التحقق بخطوتين عند دخوله القادم." };
        }
        case "resetPassword": {
            const tempPassword = generateTempPassword();
            await db.$transaction([
                db.user.update({
                    where: { id: target.id },
                    data: {
                        passwordHash: await hashPassword(tempPassword),
                        mustChangePassword: true,
                        failedLoginCount: 0,
                        lockedUntil: null,
                    },
                }),
                db.session.deleteMany({ where: { userId: target.id } }),
            ]);
            await log("user.password_reset");
            revalidatePath("/settings/users");
            return { ok: "تم تعيين كلمة مرور مؤقتة.", tempPassword, email: target.email };
        }
        default:
            return { error: "إجراء غير معروف." };
    }
}
