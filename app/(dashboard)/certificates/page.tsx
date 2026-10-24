import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download, Plus, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { arDate } from "@/lib/certificates/format";
import { TYPE_LABELS, isCertType, type CertDetails } from "@/lib/certificates/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "الشهادات" };

const PAGE_SIZE = 25;
type Filters = { q?: string; type?: string; status?: string; batch?: string; page?: string };

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<Filters> }) {
    await requireSection("certificates");
    const sp = await searchParams;
    const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
    const where: Prisma.CertificateWhereInput = {};
    if (isCertType(sp.type)) where.type = sp.type;
    if (sp.status === "ACTIVE" || sp.status === "REVOKED") where.status = sp.status;
    if (sp.batch) where.batchId = sp.batch.slice(0, 32);
    const q = sp.q?.trim().slice(0, 100);
    if (q) where.OR = [{ code: { contains: q.toUpperCase() } }, { nameAr: { contains: q } }, { nameEn: { contains: q } }, { email: { contains: q.toLowerCase() } }];

    const [rows, total, counts] = await Promise.all([
        db.certificate.findMany({ where, orderBy: [{ createdAt: "desc" }, { nameEn: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
        db.certificate.count({ where }),
        db.certificate.groupBy({ by: ["type"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    ]);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const countOf = (t: string) => counts.find((c) => c.type === t)?._count._all ?? 0;
    const qs = (patch: Partial<Filters>) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries({ ...sp, page: undefined, ...patch })) if (v) p.set(k, v);
        const s = p.toString();
        return s ? `/certificates?${s}` : "/certificates";
    };
    const subject = (d: CertDetails) => d.titleAr ?? d.departmentAr ?? "—";

    return (
        <>
            <PageHeader
                title="الشهادات"
                description={`${countOf("INTERNSHIP")} تدريب · ${countOf("ATTENDANCE")} حضور · ${countOf("COURSE")} كورس (الصالحة)`}
                action={
                    <div className="flex flex-wrap gap-2">
                        <Link href="/certificates/bulk" className={buttonClass("secondary", "md")}>
                            <Upload className="size-4" aria-hidden />
                            إصدار جماعي
                        </Link>
                        <Link href="/certificates/new" className={buttonClass("primary", "md")}>
                            <Plus className="size-4" aria-hidden />
                            إصدار شهادة
                        </Link>
                    </div>
                }
            />

            {sp.batch && (
                <div className="mb-6">
                    <Alert tone="success">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span>
                                تم إصدار {total} شهادة دفعة واحدة. حمّلها كلها في ملف PDF واحد جاهز للطباعة، أو افتح أي شهادة لوحدها.
                            </span>
                            <span className="flex gap-2">
                                <a href={`/certificates/batch/${encodeURIComponent(sp.batch)}/pdf`} className={buttonClass("primary", "sm")}>
                                    <Download className="size-4" aria-hidden />
                                    تحميل الكل PDF
                                </a>
                                <Link href="/certificates" className={buttonClass("ghost", "sm")}>
                                    كل الشهادات
                                </Link>
                            </span>
                        </div>
                    </Alert>
                </div>
            )}

            <form action="/certificates" className="mb-4 flex flex-wrap items-center gap-2">
                {sp.batch && <input type="hidden" name="batch" value={sp.batch} />}
                <input
                    name="q"
                    defaultValue={sp.q ?? ""}
                    placeholder="بحث بالاسم أو الرقم أو الإيميل"
                    aria-label="بحث"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm sm:max-w-sm"
                />
                <select name="type" defaultValue={sp.type ?? ""} aria-label="النوع" className="h-9 rounded-lg border border-line bg-white px-3 text-sm">
                    <option value="">كل الأنواع</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                            {v}
                        </option>
                    ))}
                </select>
                <select name="status" defaultValue={sp.status ?? ""} aria-label="الحالة" className="h-9 rounded-lg border border-line bg-white px-3 text-sm">
                    <option value="">كل الحالات</option>
                    <option value="ACTIVE">صالحة</option>
                    <option value="REVOKED">ملغاة</option>
                </select>
                <button type="submit" className={buttonClass("secondary", "sm")}>
                    تطبيق
                </button>
            </form>

            <Card className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 text-start font-medium">رقم الشهادة</th>
                            <th className="px-4 py-3 text-start font-medium">الاسم</th>
                            <th className="px-4 py-3 text-start font-medium">النوع</th>
                            <th className="px-4 py-3 text-start font-medium">الموضوع</th>
                            <th className="px-4 py-3 text-start font-medium">تاريخ الإصدار</th>
                            <th className="px-4 py-3 text-start font-medium">الحالة</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map((c) => (
                            <tr key={c.id} className={cn("relative hover:bg-muted/60", c.status === "REVOKED" && "opacity-60")}>
                                <td className="px-4 py-3">
                                    <Link href={`/certificates/${c.id}`} className="ltr font-mono text-xs font-medium after:absolute after:inset-0 hover:underline">
                                        {c.code}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="ltr text-start">{c.nameEn}</p>
                                    <p className="text-xs text-muted-foreground">{c.nameAr}</p>
                                </td>
                                <td className="px-4 py-3">{TYPE_LABELS[c.type]}</td>
                                <td className="max-w-[220px] truncate px-4 py-3">{subject(c.details as CertDetails)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{arDate(c.issuedAt)}</td>
                                <td className="px-4 py-3">
                                    <Badge tone={c.status === "ACTIVE" ? "success" : "danger"}>{c.status === "ACTIVE" ? "صالحة" : "ملغاة"}</Badge>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                    لا توجد شهادات بعد. ابدأ بـ <Link href="/certificates/new" className="text-primary hover:underline">إصدار شهادة</Link>.
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
