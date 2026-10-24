import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { buildChecksWhere, type CheckFilters } from "@/lib/breach/checks-query";
import { emailFingerprint } from "@/lib/breach/fingerprint";
import { open } from "@/lib/auth/secret-box";
import { cn, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "سجل فحوصات الإيميل" };

const PAGE_SIZE = 50;
const DAY_MS = 24 * 3600_000;
const ammanDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" });
const shortDay = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: "Asia/Amman", day: "numeric", month: "short" });

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <Card className="p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </Card>
    );
}

export default async function EmailChecksPage({ searchParams }: { searchParams: Promise<CheckFilters> }) {
    await requireSection("emails");
    const sp = await searchParams;
    const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
    const where = buildChecksWhere(sp);
    const now = Date.now();
    const month = new Date(now - 30 * DAY_MS);
    const fortnight = new Date(now - 13 * DAY_MS);

    const [rows, total, monthCount, monthBreached, monthUnique, monthCompany, recentDays, recentBreaches, topDomains, monitored] = await Promise.all([
        db.breachCheckStat.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
        db.breachCheckStat.count({ where }),
        db.breachCheckStat.count({ where: { createdAt: { gte: month } } }),
        db.breachCheckStat.count({ where: { createdAt: { gte: month }, breachCount: { gt: 0 } } }),
        db.breachCheckStat.groupBy({ by: ["emailHash"], where: { createdAt: { gte: month } } }).then((g) => g.length),
        db.breachCheckStat.count({ where: { createdAt: { gte: month }, isCompany: true } }),
        db.breachCheckStat.findMany({ where: { createdAt: { gte: new Date(`${ammanDay.format(fortnight)}T00:00:00+03:00`) } }, select: { createdAt: true }, take: 50000 }),
        db.breachCheckStat.findMany({ where: { createdAt: { gte: month }, breachCount: { gt: 0 } }, select: { breaches: true }, take: 5000 }),
        db.breachCheckStat.groupBy({
            by: ["emailDomain"],
            where: { isCompany: true, emailDomain: { not: null }, createdAt: { gte: new Date(now - 90 * DAY_MS) } },
            _count: { _all: true },
            _sum: { breachCount: true },
            orderBy: { _count: { emailDomain: "desc" } },
            take: 10,
        }),
        db.monitoredEmail.findMany({ select: { email: true } }),
    ]);

    // How often each person on this page has checked (all time), and who later subscribed.
    const hashes = [...new Set(rows.map((r) => r.emailHash))];
    const repeats = new Map<string, number>(
        (await db.breachCheckStat.groupBy({ by: ["emailHash"], where: { emailHash: { in: hashes } }, _count: { _all: true } })).map((g) => [g.emailHash, g._count._all])
    );
    const subscribed = new Set(monitored.map((m) => emailFingerprint(m.email)).filter(Boolean));

    // Checks per day, last 14 days (Amman time).
    const days = Array.from({ length: 14 }, (_, i) => ammanDay.format(new Date(now - (13 - i) * DAY_MS)));
    const perDay = new Map(days.map((d) => [d, 0]));
    for (const r of recentDays) {
        const d = ammanDay.format(r.createdAt);
        if (perDay.has(d)) perDay.set(d, perDay.get(d)! + 1);
    }
    const maxDay = Math.max(1, ...perDay.values());

    const breachTally = new Map<string, number>();
    for (const r of recentBreaches) for (const name of (r.breaches as string[] | null) ?? []) breachTally.set(name, (breachTally.get(name) ?? 0) + 1);
    const topBreaches = [...breachTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const qs = (patch: Partial<CheckFilters>) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries({ ...sp, page: undefined, ...patch })) if (v) p.set(k, v);
        const s = p.toString();
        return s ? `?${s}` : "";
    };
    const filtered = !!(sp.q || sp.breached || sp.company || sp.from || sp.to);

    return (
        <>
            <Link href="/security/emails" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                مراقبة الإيميلات
            </Link>
            <PageHeader
                title="سجل فحوصات الإيميل"
                description="كل فحص تم على zad.gg/security. الإيميلات محفوظة مشفّرة، ولا تظهر إلا هنا."
                action={
                    <a href={`/security/emails/checks/export${qs({})}`} className={buttonClass("secondary", "md")}>
                        <Download className="size-4" aria-hidden />
                        تصدير CSV
                    </a>
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="فحوصات آخر 30 يوماً" value={monthCount} hint={`${monthUnique} شخص مختلف`} />
                <Stat label="ظهرت في تسريبات" value={monthCount ? `${Math.round((monthBreached / monthCount) * 100)}%` : "—"} hint={`${monthBreached} فحص`} />
                <Stat label="من دومينات شركات" value={monthCount ? `${Math.round((monthCompany / monthCount) * 100)}%` : "—"} hint={`${monthCompany} فحص · فرص بيع محتملة`} />
                <Stat label="اشتركوا بالتنبيهات" value={monitored.length} hint="كل الإيميلات تحت المراقبة" />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                    <CardHeader title="الفحوصات يومياً" description="آخر 14 يوماً" />
                    <div className="flex h-40 items-end gap-1 px-5 pt-4 pb-2" role="img" aria-label="عدد الفحوصات في كل يوم من آخر 14 يوماً">
                        {days.map((d) => {
                            const n = perDay.get(d)!;
                            return (
                                <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${shortDay.format(new Date(`${d}T12:00:00+03:00`))}: ${n}`}>
                                    {n > 0 && <span className="text-[10px] text-muted-foreground">{n}</span>}
                                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(n ? 4 : 1, (n / maxDay) * 100)}%` }} />
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between px-5 pb-4 text-[10px] text-muted-foreground">
                        <span>{shortDay.format(new Date(`${days[0]}T12:00:00+03:00`))}</span>
                        <span>اليوم</span>
                    </div>
                </Card>

                <Card>
                    <CardHeader title="أكثر دومينات الشركات" description="آخر 90 يوماً. شركة تفحص إيميلاتها تهتم بالأمان." />
                    <ul className="divide-y divide-line text-sm">
                        {topDomains.map((d) => (
                            <li key={d.emailDomain}>
                                <Link href={`?q=${encodeURIComponent(d.emailDomain ?? "")}`} className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-muted/60">
                                    <span className="ltr flex items-center gap-2">
                                        <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
                                        {d.emailDomain}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {d._count._all} فحص{d._sum.breachCount ? ` · ${d._sum.breachCount} تسريب` : ""}
                                    </span>
                                </Link>
                            </li>
                        ))}
                        {topDomains.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground">لا يوجد بعد.</li>}
                    </ul>
                </Card>

                <Card>
                    <CardHeader title="أكثر التسريبات ظهوراً" description="آخر 30 يوماً" />
                    <ul className="divide-y divide-line text-sm">
                        {topBreaches.map(([name, n]) => (
                            <li key={name} className="flex items-center justify-between gap-2 px-5 py-2.5">
                                <span className="ltr truncate">{name}</span>
                                <span className="text-xs text-muted-foreground">{n}</span>
                            </li>
                        ))}
                        {topBreaches.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground">لا يوجد بعد.</li>}
                    </ul>
                </Card>
            </div>

            <form className="mt-8 mb-4 flex flex-wrap items-end gap-2">
                <input
                    name="q"
                    defaultValue={sp.q ?? ""}
                    placeholder="إيميل كامل أو دومين، مثل store.com"
                    aria-label="بحث بالإيميل أو الدومين"
                    dir="ltr"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm sm:max-w-xs"
                />
                <label className="text-xs text-muted-foreground">
                    من
                    <input type="date" name="from" defaultValue={sp.from ?? ""} dir="ltr" className="ms-1 h-9 rounded-lg border border-line bg-white px-2 text-sm" />
                </label>
                <label className="text-xs text-muted-foreground">
                    إلى
                    <input type="date" name="to" defaultValue={sp.to ?? ""} dir="ltr" className="ms-1 h-9 rounded-lg border border-line bg-white px-2 text-sm" />
                </label>
                <label className="flex h-9 items-center gap-1.5 text-sm">
                    <input type="checkbox" name="breached" value="1" defaultChecked={sp.breached === "1"} />
                    فيها تسريبات
                </label>
                <label className="flex h-9 items-center gap-1.5 text-sm">
                    <input type="checkbox" name="company" value="1" defaultChecked={sp.company === "1"} />
                    دومينات شركات
                </label>
                <button type="submit" className={buttonClass("secondary", "sm")}>
                    تطبيق
                </button>
                {filtered && (
                    <Link href="/security/emails/checks" className="text-sm text-muted-foreground hover:underline">
                        مسح
                    </Link>
                )}
            </form>

            <Card className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 text-start font-medium">الوقت</th>
                            <th className="px-4 py-3 text-start font-medium">الإيميل</th>
                            <th className="px-4 py-3 text-start font-medium">النتيجة</th>
                            <th className="px-4 py-3 text-start font-medium">التسريبات</th>
                            <th className="px-4 py-3 text-start font-medium">مرات الفحص</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map((r) => {
                            const times = repeats.get(r.emailHash) ?? 1;
                            const names = (r.breaches as string[] | null) ?? [];
                            let shown: string | null = r.emailMasked;
                            if (r.emailSealed) {
                                try {
                                    shown = open(r.emailSealed);
                                } catch {
                                    shown = r.emailMasked;
                                }
                            }
                            return (
                                <tr key={r.id} className="align-top">
                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                                    <td className="px-4 py-3">
                                        <span className="ltr inline-flex items-center gap-2">
                                            {shown ?? <span className="text-muted-foreground">— (قبل تفعيل السجل)</span>}
                                            {r.isCompany && (
                                                <Link href={`?q=${encodeURIComponent(r.emailDomain ?? "")}`}>
                                                    <Badge tone="primary">شركة</Badge>
                                                </Link>
                                            )}
                                            {subscribed.has(r.emailHash) && <Badge tone="success">مشترك</Badge>}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {r.breachCount ? <Badge tone="danger">{r.breachCount} تسريب</Badge> : <Badge tone="success">نظيف</Badge>}
                                    </td>
                                    <td className="ltr max-w-[320px] px-4 py-3 text-start text-xs text-muted-foreground">
                                        {names.length ? names.slice(0, 6).join(" · ") + (names.length > 6 ? ` +${names.length - 6}` : "") : "—"}
                                    </td>
                                    <td className={cn("px-4 py-3", times > 1 && "font-medium")}>{times > 1 ? `${times} مرات` : "مرة"}</td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                                    {filtered ? "لا توجد فحوصات بهذه التصفية." : "لم يتم أي فحص بعد. الفحوصات على zad.gg/security تظهر هنا تلقائياً."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {pages > 1 && (
                <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="الصفحات">
                    {page > 1 && (
                        <Link className={buttonClass("secondary", "sm")} href={qs({ page: String(page - 1) }) || "?"}>
                            السابق
                        </Link>
                    )}
                    <span className="text-muted-foreground">
                        صفحة {page} من {pages} · {total} فحص
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
