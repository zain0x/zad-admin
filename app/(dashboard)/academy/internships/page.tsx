import type { Metadata } from "next";
import Link from "next/link";
import type { InternshipStatus, Prisma } from "@prisma/client";
import { FileText, GraduationCap, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { INTERNSHIPS_OPEN, INTERNSHIP_FIELDS, INTERNSHIP_ORDER, INTERNSHIP_STATUS, getSetting, isInternshipStatus } from "@/lib/academy";
import { cn, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { toggleInternshipsAction } from "./actions";

export const metadata: Metadata = { title: "طلبات التدريب" };

const PAGE_SIZE = 30;
type SP = { status?: string; field?: string; q?: string; page?: string };

export default async function InternshipsPage({ searchParams }: { searchParams: Promise<SP> }) {
    await requireSection("internships");
    const sp = await searchParams;
    const status = isInternshipStatus(sp.status) ? (sp.status as InternshipStatus) : undefined;
    const field = INTERNSHIP_FIELDS.includes(sp.field ?? "") ? sp.field : undefined;
    const q = (sp.q ?? "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

    const where: Prisma.InternshipApplicationWhereInput = {
        ...(status ? { status } : {}),
        ...(field ? { field } : {}),
        ...(q
            ? {
                  OR: [
                      { nameAr: { contains: q } },
                      { nameEn: { contains: q } },
                      { email: { contains: q } },
                      { phone: { contains: q } },
                      { university: { contains: q } },
                      ...(/^\d+$/.test(q) ? [{ id: Number(q) }] : []),
                  ],
              }
            : {}),
    };

    const [rows, total, byStatus, open] = await Promise.all([
        db.internshipApplication.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: { supervisor: { select: { name: true } } },
        }),
        db.internshipApplication.count({ where }),
        db.internshipApplication.groupBy({ by: ["status"], _count: { _all: true } }),
        getSetting<boolean>(INTERNSHIPS_OPEN, true),
    ]);
    const countOf = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
    const all = byStatus.reduce((n, b) => n + b._count._all, 0);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const qs = (patch: Partial<SP>) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries({ status, field, q: q || undefined, ...patch })) if (v) p.set(k, String(v));
        const s = p.toString();
        return s ? `/academy/internships?${s}` : "/academy/internships";
    };

    return (
        <>
            <PageHeader
                title="طلبات التدريب"
                description="طلبات طلاب الجامعات للتدريب في زاد."
                action={
                    <form action={toggleInternshipsAction} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-2.5">
                        <span className="flex items-center gap-2 text-sm">
                            <span className={cn("size-2 rounded-full", open ? "bg-emerald-500" : "bg-red-500")} aria-hidden />
                            {open ? "استقبال الطلبات مفتوح" : "استقبال الطلبات متوقف"}
                        </span>
                        <input type="hidden" name="open" value={open ? "0" : "1"} />
                        <button type="submit" className={cn("rounded-md px-3 py-1 text-xs font-medium", open ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100")}>
                            {open ? "إيقاف" : "فتح"}
                        </button>
                    </form>
                }
            />

            <div className="mb-4 flex flex-wrap gap-1.5">
                {[{ key: undefined as InternshipStatus | undefined, label: "الكل", count: all }, ...INTERNSHIP_ORDER.map((s) => ({ key: s, label: INTERNSHIP_STATUS[s].label, count: countOf(s) }))].map((t) => (
                    <Link
                        key={t.label}
                        href={qs({ status: t.key, page: undefined })}
                        className={cn(
                            "rounded-full border px-3 py-1 text-sm",
                            status === t.key ? "border-primary bg-primary text-white" : "border-line bg-white text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t.label} <span className="opacity-70">{t.count}</span>
                    </Link>
                ))}
            </div>

            <form className="mb-4 flex flex-wrap gap-2" action="/academy/internships">
                {status && <input type="hidden" name="status" value={status} />}
                <div className="relative min-w-60 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input name="q" defaultValue={q} placeholder="ابحث بالاسم، الإيميل، الجامعة، أو رقم الطلب" className="ps-9" />
                </div>
                <Select name="field" defaultValue={field ?? ""} className="w-auto">
                    <option value="">كل المجالات</option>
                    {INTERNSHIP_FIELDS.map((f) => (
                        <option key={f}>{f}</option>
                    ))}
                </Select>
                <button type="submit" className="rounded-lg bg-foreground px-4 text-sm text-white">
                    بحث
                </button>
            </form>

            <Card>
                {rows.length === 0 ? (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                        <GraduationCap className="mx-auto mb-2 size-9" aria-hidden />
                        ما في طلبات{q || status || field ? " بهذا البحث" : " لسا"}.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2.5 text-start font-medium">#</th>
                                    <th className="px-4 py-2.5 text-start font-medium">الطالب</th>
                                    <th className="px-4 py-2.5 text-start font-medium">الجامعة</th>
                                    <th className="px-4 py-2.5 text-start font-medium">المجال</th>
                                    <th className="px-4 py-2.5 text-start font-medium">الحالة</th>
                                    <th className="px-4 py-2.5 text-start font-medium">وصل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {rows.map((a) => (
                                    <tr key={a.id} className="hover:bg-muted/40">
                                        <td className="px-4 py-3 text-muted-foreground">
                                            <Link href={`/academy/internships/${a.id}`} className="hover:text-primary">
                                                {a.id}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={`/academy/internships/${a.id}`} className="font-medium hover:text-primary">
                                                {a.nameAr}
                                            </Link>
                                            <p className="ltr text-start text-xs text-muted-foreground">{a.email}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            {a.university}
                                            {a.major && <p className="text-xs text-muted-foreground">{a.major}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5">
                                                {a.field}
                                                {a.cvKey && <FileText className="size-3.5 text-muted-foreground" aria-label="مرفق سيرة ذاتية" />}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge tone={INTERNSHIP_STATUS[a.status].tone}>{INTERNSHIP_STATUS[a.status].label}</Badge>
                                            {a.supervisor && <p className="mt-1 text-xs text-muted-foreground">{a.supervisor.name}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                    {page > 1 && (
                        <Link href={qs({ page: String(page - 1) })} className="rounded-lg border border-line bg-white px-3 py-1.5">
                            السابق
                        </Link>
                    )}
                    <span className="text-muted-foreground">
                        صفحة {page} من {pages}
                    </span>
                    {page < pages && (
                        <Link href={qs({ page: String(page + 1) })} className="rounded-lg border border-line bg-white px-3 py-1.5">
                            التالي
                        </Link>
                    )}
                </div>
            )}
        </>
    );
}
