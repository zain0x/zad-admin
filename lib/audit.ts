import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getRequestMeta } from "@/lib/request";

export const AUDIT_LABELS: Record<string, string> = {
    "auth.login": "تسجيل دخول",
    "auth.login_failed": "محاولة دخول فاشلة",
    "auth.locked": "قفل الحساب مؤقتاً",
    "auth.2fa_failed": "رمز تحقق خاطئ",
    "auth.2fa_enabled": "تفعيل التحقق بخطوتين",
    "auth.backup_code_used": "استخدام رمز احتياطي",
    "auth.logout": "تسجيل خروج",
    "auth.password_changed": "تغيير كلمة المرور",
    "user.created": "إضافة موظف",
    "user.role_changed": "تغيير الدور",
    "user.deactivated": "تعطيل حساب",
    "user.activated": "تفعيل حساب",
    "user.2fa_reset": "إعادة ضبط التحقق بخطوتين",
    "user.password_reset": "إعادة تعيين كلمة المرور",
};

type AuditInput = {
    actorId: string | null;
    action: keyof typeof AUDIT_LABELS | string;
    targetType?: string;
    targetId?: string;
    details?: Prisma.InputJsonValue;
};

/** Never throws: a failed audit write must not break the action it records. */
export async function audit(input: AuditInput) {
    try {
        const { ip } = await getRequestMeta();
        await db.auditLog.create({ data: { ...input, ip } });
    } catch (err) {
        console.error("audit log write failed", input.action, err);
    }
}
