import type { Metadata } from "next";
import Link from "next/link";
import { Download, Lock, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { SCAN_TYPES, STATUS_LABELS, STATUS_ORDER, STATUS_TONES, TYPE_LABELS, buildRequestWhere, type RequestFilters } from "@/lib/requests";
import { cn, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "فحص المواقع" };

const PAGE_SIZE = 25;

export default async function SecurityRequestsPage({ searchParams }: { searchParams: Promise<RequestFilters & { page?: string }> }) {
    const { user } = await requireSection("sites");
    const isAdmin = user.role === "ADMIN";
    const sp = await searchParams;
    const filters: RequestFilters = { status: sp.status, type: sp.type, q: sp.q, mine: sp.mine };
    const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
    const where = buildRequestWhere(filters, user);
    const now = new Date();

    const [rows, total, byStatus] = await Promise.all([
        db.scanRequest.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: { assignee: { select: { name: true } }, _count: { select: { findings: true } } },
        }),
        db.scanRequest.count({ where }),
        db.scanRequest.groupBy({
            by: ["status"],
            where: { type: { in: SCAN_TYPES }, ...(isAdmin ? {} : { assigneeId: user.id }) },
            _count: { _all: true },
        }),
    ]);
    const countOf = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
    const all = byStatus.reduce((n, b) => n + b._count._all, 0);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const qs = (patch: Record<string, string | undefined>) => {
        const merged: Record<string, string | undefined> = { ...filters, page: undefined, ...patch };
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
        const s = p.toString();
        return s ? `/security?${s}` : "/security";
    };
    const exportQs = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1])).toString();

    const tabs: { key?: string; label: string; count: number }[] = [
        { key: undefined, label: "الكل", count: all },
        { key: "open", label: "قيد المتابعة", count: countOf("NEW") + countOf("CONTACTED") + countOf("SCANNING") },
        ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABELS[s], count: countOf(s) })),
    ];

    return (
        <>
            <PageHeader
                title="فحص المواقع"
                description={isAdmin ? "طلبات فحص المواقع والتسريبات من zad.gg/security، والطلبات اللي تنشئها هنا." : "طلبات الفحص المسندة لك."}
                action={
                    <div className="flex flex-wrap gap-2">
                        <a href={`/security/export${exportQs ? `?${exportQs}` : ""}`} className={buttonClass("secondary", "md")}>
                            <Download className="size-4" aria-hidden />
                            تصدير CSV
                        </a>
                        {isAdmin && (
                            <Link href="/security/new" className={buttonClass("primary", "md")}>
                                <Plus className="size-4" aria-hidden />
                                طلب فحص جديد
                            </Link>
                        )}
                    </div>
                }
            />

            <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="حالة الطلب">
                {tabs.map((t) => {
                    const active = (filters.status ?? undefined) === t.key;
                    return (
                        <Link
                            key={t.label}
                            href={qs({ status: t.key })}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap",
                                active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t.label}
                            <span className="rounded-full bg-muted px-1.5 text-xs">{t.count}</span>
                        </Link>
                    );
                })}
            </nav>

            <form action="/security" className="mb-4 flex flex-wrap items-center gap-2">
                {filters.status && <input type="hidden" name="status" value={filters.status} />}
                <input
                    name="q"
                    defaultValue={filters.q ?? ""}
                    placeholder="بحث بالاسم أو الإيميل أو الموقع أو الرقم"
                    aria-label="بحث"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm sm:max-w-sm"
                />
                <select name="type" defaultValue={filters.type ?? ""} aria-label="نوع الطلب" className="h-9 rounded-lg border border-line bg-white px-3 text-sm">
                    <option value="">كل الأنواع</option>
                    {SCAN_TYPES.map((k) => [k, TYPE_LABELS[k]] as const).map(([k, v]) => (
                        <option key={k} value={k}>
                            {v}
                        </option>
                    ))}
                </select>
                {isAdmin && (
                    <label className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name="mine" value="1" defaultChecked={filters.mine === "1"} />
                        طلباتي فقط
                    </label>
                )}
                <button type="submit" className={buttonClass("secondary", "sm")}>
                    تطبيق
                </button>
                {(filters.q || filters.type || filters.mine) && (
                    <Link href={qs({ q: undefined, type: undefined, mine: undefined })} className="text-sm text-muted-foreground hover:underline">
                        مسح
                    </Link>
                )}
            </form>

            <Card className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 text-start font-medium">#</th>
                            <th className="px-4 py-3 text-start font-medium">النوع</th>
                            <th className="px-4 py-3 text-start font-medium">صاحب الطلب</th>
                            <th className="px-4 py-3 text-start font-medium">الموقع</th>
                            <th className="px-4 py-3 text-start font-medium">الحالة</th>
                            <th className="px-4 py-3 text-start font-medium">المسؤول</th>
                            <th className="px-4 py-3 text-start font-medium">الثغرات</th>
                            <th className="px-4 py-3 text-start font-medium">التسليم</th>
                            <th className="px-4 py-3 text-start font-medium">التاريخ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map((r) => (
                            <tr key={r.id} className="relative hover:bg-muted/60">
                                <td className="px-4 py-3 font-medium">
                                    <Link href={`/security/${r.id}`} className="after:absolute after:inset-0 hover:underline">
                                        {r.id}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">{TYPE_LABELS[r.type]}</td>
                                <td className="px-4 py-3">
                                    <p>{r.name ?? "—"}</p>
                                    <p className="ltr text-xs text-muted-foreground">{r.email}</p>
                                </td>
                                <td className="ltr max-w-[220px] truncate px-4 py-3 text-start">{r.target?.replace(/^https?:\/\//, "") ?? "—"}</td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center gap-1">
                                        <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                                        {r.closedAt && <Lock className="size-3.5 text-muted-foreground" aria-label="الملف مقفل" />}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{r.assignee?.name ?? "—"}</td>
                                <td className="px-4 py-3 text-muted-foreground">{r._count.findings || "—"}</td>
                                <td className={cn("px-4 py-3 whitespace-nowrap text-xs", !r.closedAt && r.dueAt && r.dueAt < now ? "font-medium text-red-600" : "text-muted-foreground")}>
                                    {r.dueAt ? formatDateTime(r.dueAt).split("،")[0] : "—"}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                                    {all === 0
                                        ? isAdmin
                                            ? "لم يصل أي طلب بعد. الطلبات من zad.gg/security تظهر هنا تلقائياً."
                                            : "لا توجد طلبات مسندة لك حالياً."
                                        : "لا توجد طلبات بهذه التصفية."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {pages > 1 && (
                <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="الصفحات">
                    {page > 1 && (
                        <Link className={buttonClass("secondary", "sm")} href={qs({ page: String(page - 1) })}>
                            السابق
                        </Link>
                    )}
                    <span className="text-muted-foreground">
                        صفحة {page} من {pages}
                    </span>
                    {page < pages && (
                        <Link className={buttonClass("secondary", "sm")} href={qs({ page: String(page + 1) })}>
                            التالي
                        </Link>
                    )}
                </nav>
            )}
        </>
    );
}
