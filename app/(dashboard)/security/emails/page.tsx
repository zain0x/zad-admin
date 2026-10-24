import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { cn, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { importOldSignupsAction } from "./actions";
import { AddEmailsForm, RunDueButton } from "./forms";

export const metadata: Metadata = { title: "مراقبة الإيميلات" };

const PAGE_SIZE = 30;
type Filters = { q?: string; show?: string; page?: string; removed?: string };

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "danger" }) {
    return (
        <Card className="p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("mt-2 text-3xl font-bold", tone === "danger" && "text-red-600")}>{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </Card>
    );
}

export default async function MonitoredEmailsPage({ searchParams }: { searchParams: Promise<Filters> }) {
    const { user } = await requireSection("emails");
    const sp = await searchParams;
    const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
    const now = new Date();
    const month = new Date(now.getTime() - 30 * 24 * 3600_000);

    const where: Prisma.MonitoredEmailWhereInput = {};
    if (sp.show === "new") where.hasNewBreach = true;
    else if (sp.show === "breached") where.breachCount = { gt: 0 };
    else if (sp.show === "paused") where.status = "PAUSED";
    else if (sp.show === "due") Object.assign(where, { status: "ACTIVE", nextCheckAt: { lte: now } });
    const q = sp.q?.trim().toLowerCase().slice(0, 100);
    if (q) where.OR = [{ email: { contains: q } }, { note: { contains: q } }];

    const [rows, total, active, newAlerts, breached, due, siteChecks, siteBreached, siteUnique, oldSignups] = await Promise.all([
        db.monitoredEmail.findMany({ where, orderBy: [{ hasNewBreach: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
        db.monitoredEmail.count({ where }),
        db.monitoredEmail.count({ where: { status: "ACTIVE" } }),
        db.monitoredEmail.count({ where: { hasNewBreach: true } }),
        db.monitoredEmail.count({ where: { breachCount: { gt: 0 } } }),
        db.monitoredEmail.count({ where: { status: "ACTIVE", nextCheckAt: { lte: now } } }),
        db.breachCheckStat.count({ where: { createdAt: { gte: month } } }),
        db.breachCheckStat.count({ where: { createdAt: { gte: month }, breachCount: { gt: 0 } } }),
        db.breachCheckStat.groupBy({ by: ["emailHash"], where: { createdAt: { gte: month } } }).then((g) => g.length),
        db.scanRequest.count({ where: { type: "NOTIFY", status: { not: "CLOSED" } } }),
    ]);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const qs = (patch: Partial<Filters>) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries({ ...sp, removed: undefined, page: undefined, ...patch })) if (v) p.set(k, v);
        const s = p.toString();
        return s ? `/security/emails?${s}` : "/security/emails";
    };
    const tabs = [
        { key: undefined, label: "الكل" },
        { key: "new", label: `تسريب جديد (${newAlerts})` },
        { key: "breached", label: "فيها تسريبات" },
        { key: "due", label: `مستحقة الفحص (${due})` },
        { key: "paused", label: "متوقفة" },
    ];

    return (
        <>
            <PageHeader
                title="مراقبة الإيميلات"
                description="كل إيميل هنا يُفحص تلقائياً أسبوعياً أو شهرياً في Have I Been Pwned وLeakCheck، وأي تسريب جديد يظهر بعلامة حمراء."
                action={user.role === "ADMIN" ? <RunDueButton due={due} /> : undefined}
            />

            {sp.removed && (
                <div className="mb-6">
                    <Alert tone="success">تم حذف الإيميل من المراقبة.</Alert>
                </div>
            )}
            {oldSignups > 0 && user.role === "ADMIN" && (
                <div className="mb-6">
                    <Alert tone="info">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span>في {oldSignups} اشتراك بالتنبيهات وصل قبل إضافة هذه الصفحة، موجود مع طلبات الفحص.</span>
                            <form action={importOldSignupsAction}>
                                <SubmitButton size="sm" pendingText="جارٍ الاستيراد…">
                                    نقلها للمراقبة
                                </SubmitButton>
                            </form>
                        </div>
                    </Alert>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="إيميلات تحت المراقبة" value={active} hint={`${breached} منها ظهرت في تسريبات`} />
                <Stat label="تسريبات جديدة لم تُراجع" value={newAlerts} tone={newAlerts ? "danger" : undefined} />
                <Stat label="فحوصات على الموقع" value={siteChecks} hint={`آخر 30 يوماً · ${siteUnique} إيميل مختلف`} />
                <Stat
                    label="نسبة المسرّب من فحوصات الموقع"
                    value={siteChecks ? `${Math.round((siteBreached / siteChecks) * 100)}%` : "—"}
                    hint="بدون حفظ الإيميلات نفسها"
                />
            </div>

            <Card className="mt-6">
                <CardHeader title="إضافة إيميلات للمراقبة" description="مثلاً إيميلات عملاء زاد أو إيميلات فريقكم." />
                <AddEmailsForm />
            </Card>

            <nav className="mt-8 mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="تصفية">
                {tabs.map((t) => {
                    const activeTab = (sp.show ?? undefined) === t.key;
                    return (
                        <Link
                            key={t.label}
                            href={qs({ show: t.key })}
                            aria-current={activeTab ? "page" : undefined}
                            className={cn(
                                "-mb-px border-b-2 px-3 py-2.5 text-sm whitespace-nowrap",
                                activeTab ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </nav>

            <form action="/security/emails" className="mb-4 flex gap-2">
                {sp.show && <input type="hidden" name="show" value={sp.show} />}
                <input
                    name="q"
                    defaultValue={sp.q ?? ""}
                    placeholder="بحث بالإيميل أو الملاحظة"
                    aria-label="بحث"
                    dir="auto"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm sm:max-w-sm"
                />
                <button type="submit" className={buttonClass("secondary", "sm")}>
                    بحث
                </button>
            </form>

            <Card className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 text-start font-medium">الإيميل</th>
                            <th className="px-4 py-3 text-start font-medium">التسريبات</th>
                            <th className="px-4 py-3 text-start font-medium">التكرار</th>
                            <th className="px-4 py-3 text-start font-medium">آخر فحص</th>
                            <th className="px-4 py-3 text-start font-medium">الفحص القادم</th>
                            <th className="px-4 py-3 text-start font-medium">المصدر</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map((m) => (
                            <tr key={m.id} className={cn("relative hover:bg-muted/60", m.hasNewBreach && "bg-red-50/60")}>
                                <td className="px-4 py-3">
                                    <Link href={`/security/emails/${m.id}`} className="ltr block text-start font-medium after:absolute after:inset-0 hover:underline">
                                        {m.email}
                                    </Link>
                                    {m.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.note}</p>}
                                </td>
                                <td className="px-4 py-3">
                                    {!m.lastCheckedAt ? (
                                        <Badge>لم يُفحص بعد</Badge>
                                    ) : m.hasNewBreach ? (
                                        <Badge tone="danger">تسريب جديد · {m.breachCount}</Badge>
                                    ) : m.breachCount ? (
                                        <Badge tone="warning">{m.breachCount} تسريب</Badge>
                                    ) : (
                                        <Badge tone="success">نظيف</Badge>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {m.status === "PAUSED" ? <Badge>متوقف</Badge> : m.frequency === "WEEKLY" ? "أسبوعي" : "شهري"}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(m.lastCheckedAt)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                    {m.status === "PAUSED" ? "—" : m.nextCheckAt <= now ? "مستحق الآن" : formatDateTime(m.nextCheckAt)}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{m.source === "manual" ? "أضافه موظف" : "اشتراك من الموقع"}</td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                    لا توجد إيميلات هنا. الاشتراكات بالتنبيهات من zad.gg/security تظهر هنا تلقائياً.
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
