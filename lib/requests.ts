import type { Prisma, RequestStatus, ScanType, Severity, User } from "@prisma/client";

export const STATUS_LABELS: Record<RequestStatus, string> = {
    NEW: "جديد",
    CONTACTED: "تم التواصل",
    SCANNING: "قيد الفحص",
    REPORT_SENT: "تم تسليم التقرير",
    CONVERTED: "تحوّل لعميل",
    CLOSED: "مغلق",
};

export const STATUS_ORDER: RequestStatus[] = ["NEW", "CONTACTED", "SCANNING", "REPORT_SENT", "CONVERTED", "CLOSED"];

export const STATUS_TONES: Record<RequestStatus, "primary" | "warning" | "neutral" | "success" | "danger"> = {
    NEW: "primary",
    CONTACTED: "warning",
    SCANNING: "warning",
    REPORT_SENT: "neutral",
    CONVERTED: "success",
    CLOSED: "neutral",
};

export const TYPE_LABELS: Record<ScanType, string> = {
    SITE: "فحص موقع",
    LEAK: "فحص تسريبات",
    NOTIFY: "اشتراك بالتنبيهات",
};

/** Still being worked on (not finished one way or another). */
export const OPEN_STATUSES: RequestStatus[] = ["NEW", "CONTACTED", "SCANNING"];

export function isStatus(v: unknown): v is RequestStatus {
    return typeof v === "string" && (STATUS_ORDER as string[]).includes(v);
}

export function isType(v: unknown): v is ScanType {
    return v === "SITE" || v === "LEAK" || v === "NOTIFY";
}

export type RequestFilters = { status?: string; type?: string; q?: string; mine?: string };

/** Site/leak scan requests. Old breach-alert sign-ups (NOTIFY) now live in email monitoring. */
export const SCAN_TYPES: ScanType[] = ["SITE", "LEAK"];

/** Admins see every request; staff only the ones assigned to them. */
export function canSeeRequest(user: Pick<User, "id" | "role">, r: { assigneeId: string | null }) {
    return user.role === "ADMIN" || r.assigneeId === user.id;
}

export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export const SEVERITY: Record<Severity, { ar: string; en: string; color: string; tone: "danger" | "warning" | "primary" | "neutral" | "success" }> = {
    CRITICAL: { ar: "حرجة", en: "Critical", color: "#b91c1c", tone: "danger" },
    HIGH: { ar: "عالية", en: "High", color: "#ea580c", tone: "danger" },
    MEDIUM: { ar: "متوسطة", en: "Medium", color: "#d97706", tone: "warning" },
    LOW: { ar: "منخفضة", en: "Low", color: "#2563eb", tone: "primary" },
    INFO: { ar: "معلومات", en: "Info", color: "#6b7280", tone: "neutral" },
};

export function isSeverity(v: unknown): v is Severity {
    return typeof v === "string" && (SEVERITY_ORDER as string[]).includes(v);
}

export function buildRequestWhere(f: RequestFilters, user: Pick<User, "id" | "role">): Prisma.ScanRequestWhereInput {
    const userId = user.id;
    const where: Prisma.ScanRequestWhereInput = { type: { in: SCAN_TYPES } };
    if (user.role !== "ADMIN") where.assigneeId = user.id;
    if (isStatus(f.status)) where.status = f.status;
    else if (f.status === "open") where.status = { in: OPEN_STATUSES };
    if (f.type === "SITE" || f.type === "LEAK") where.type = f.type;
    if (f.mine === "1") where.assigneeId = userId;
    const q = f.q?.trim().slice(0, 100);
    if (q) {
        const asNumber = Number(q.replace(/^#/, ""));
        where.OR = [
            { name: { contains: q } },
            { email: { contains: q } },
            { target: { contains: q } },
            { phone: { contains: q } },
            ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ id: asNumber }] : []),
        ];
    }
    return where;
}

/** wa.me link with a ready Arabic greeting. Returns null when the number is unusable. */
export function whatsappLink(phone: string | null, name: string | null, target: string | null): string | null {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.length < 9 || digits.length > 15) return null;
    const greeting = `مرحباً${name ? ` ${name}` : ""}، معك فريق Zad Security من زاد بخصوص طلب الفحص${target ? ` لموقع ${target}` : ""}.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
}
