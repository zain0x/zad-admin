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
    "user.permissions_changed": "تغيير صلاحيات موظف",
    "request.received": "طلب جديد من الموقع",
    "request.status_changed": "تغيير حالة طلب",
    "request.assigned": "تعيين مسؤول لطلب",
    "request.note_added": "إضافة ملاحظة على طلب",
    "request.exported": "تصدير الطلبات CSV",
    "request.created": "إنشاء طلب فحص",
    "request.due_changed": "تغيير موعد التسليم",
    "request.finding_added": "إضافة ثغرة",
    "request.finding_updated": "تعديل ثغرة",
    "request.finding_deleted": "حذف ثغرة",
    "request.file_uploaded": "رفع ملف",
    "request.file_deleted": "حذف ملف",
    "request.closed": "إقفال الملف",
    "request.reopened": "إعادة فتح الملف",
    "request.report_downloaded": "تحميل تقرير الفحص",
    "cert.issued": "إصدار شهادة",
    "cert.bulk_issued": "إصدار شهادات جماعي",
    "cert.updated": "تعديل شهادة",
    "cert.revoked": "إلغاء شهادة",
    "cert.restored": "إعادة تفعيل شهادة",
    "email.added": "إضافة إيميل للمراقبة",
    "email.updated": "تعديل مراقبة إيميل",
    "email.removed": "حذف إيميل من المراقبة",
    "email.checked": "فحص إيميل يدوياً",
    "email.reviewed": "مراجعة تسريب جديد",
    "email.monitor_run": "تشغيل الفحص الدوري",
    "email.imported": "استيراد اشتراكات سابقة",
    "email.checks_exported": "تصدير سجل فحوصات الإيميل",
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
