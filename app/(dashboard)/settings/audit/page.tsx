import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { AUDIT_LABELS } from "@/lib/audit";
import { cn, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "سجل العمليات" };

const PAGE_SIZE = 50;
const ALERT_ACTIONS = new Set(["auth.login_failed", "auth.2fa_failed", "auth.locked", "user.2fa_reset", "user.deactivated"]);

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
    await requireAdmin();
    const sp = await searchParams;
    const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
    const action = sp.action && sp.action in AUDIT_LABELS ? sp.action : undefined;
    const where = action ? { action } : {};

    const [rows, total] = await Promise.all([
        db.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: { actor: { select: { name: true, email: true } } },
        }),
        db.auditLog.count({ where }),
    ]);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const href = (p: number) => `/settings/audit?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}`;

    return (
        <>
            <PageHeader title="سجل العمليات" description={`${total} عملية مسجّلة. السجل لا يمكن تعديله أو حذفه من اللوحة.`} />

            <form className="mb-4 flex flex-wrap items-center gap-2" action="/settings/audit">
                <select
                    name="action"
                    defaultValue={action ?? ""}
                    className="h-9 rounded-lg border border-line bg-white px-3 text-sm"
                    aria-label="نوع العملية"
                >
                    <option value="">كل العمليات</option>
                    {Object.entries(AUDIT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                            {v}
                        </option>
                    ))}
                </select>
                <button type="submit" className={buttonClass("secondary", "sm")}>
                    تصفية
                </button>
            </form>

            <Card className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 text-start font-medium">الوقت</th>
                            <th className="px-4 py-3 text-start font-medium">المنفّذ</th>
                            <th className="px-4 py-3 text-start font-medium">العملية</th>
                            <th className="px-4 py-3 text-start font-medium">التفاصيل</th>
                            <th className="px-4 py-3 text-start font-medium">IP</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map((r) => {
                            const details = r.details && typeof r.details === "object" && !Array.isArray(r.details) ? (r.details as Record<string, unknown>) : null;
                            return (
                                <tr key={r.id}>
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                                    <td className="px-4 py-3">{r.actor?.name ?? "—"}</td>
                                    <td className={cn("px-4 py-3", ALERT_ACTIONS.has(r.action) && "font-medium text-red-700")}>
                                        {AUDIT_LABELS[r.action] ?? r.action}
                                    </td>
                                    <td className="ltr px-4 py-3 text-start text-xs text-muted-foreground">
                                        {details ? Object.entries(details).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") : "—"}
                                    </td>
                                    <td className="ltr px-4 py-3 text-start text-xs text-muted-foreground">{r.ip ?? "—"}</td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                                    لا توجد عمليات.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {pages > 1 && (
                <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="الصفحات">
                    {page > 1 && <Link className={buttonClass("secondary", "sm")} href={href(page - 1)}>السابق</Link>}
                    <span className="text-muted-foreground">
                        صفحة {page} من {pages}
                    </span>
                    {page < pages && <Link className={buttonClass("secondary", "sm")} href={href(page + 1)}>التالي</Link>}
                </nav>
            )}
        </>
    );
}
