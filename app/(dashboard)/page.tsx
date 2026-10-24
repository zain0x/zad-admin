import Link from "next/link";
import { Award, MailWarning } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { sectionsOf } from "@/lib/auth/permissions";
import { AUDIT_LABELS } from "@/lib/audit";
import { OPEN_STATUSES, STATUS_LABELS, STATUS_TONES, TYPE_LABELS } from "@/lib/requests";
import { cn, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <Card className="h-full p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </Card>
    );
}

function Tile({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
            {children}
        </Link>
    );
}

const scans = { type: { in: ["SITE", "LEAK"] as ("SITE" | "LEAK")[] } };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ password?: string; denied?: string }> }) {
    const { user } = await requireUser();
    const sp = await searchParams;
    const isAdmin = user.role === "ADMIN";
    const sections = sectionsOf(user);
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 3600_000);
    const week = new Date(now.getTime() - 7 * 24 * 3600_000);
    const month = new Date(now.getTime() - 30 * 24 * 3600_000);
    const zero = Promise.resolve(0);

    const [newCount, weekCount, openCount, monthScans, monthConverted, myFiles, latest, certCount, certMonth, breachAlerts, failedToday, recent] = await Promise.all([
        isAdmin ? db.scanRequest.count({ where: { ...scans, status: "NEW" } }) : zero,
        isAdmin ? db.scanRequest.count({ where: { ...scans, createdAt: { gte: week } } }) : zero,
        isAdmin ? db.scanRequest.count({ where: { ...scans, status: { in: OPEN_STATUSES }, closedAt: null } }) : zero,
        isAdmin ? db.scanRequest.count({ where: { ...scans, createdAt: { gte: month } } }) : zero,
        isAdmin ? db.scanRequest.count({ where: { ...scans, createdAt: { gte: month }, status: "CONVERTED" } }) : zero,
        sections.sites
            ? db.scanRequest.findMany({
                  where: { ...scans, assigneeId: user.id, closedAt: null },
                  orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
                  take: 8,
                  include: { _count: { select: { findings: true } } },
              })
            : Promise.resolve([]),
        isAdmin ? db.scanRequest.findMany({ where: { ...scans, status: "NEW" }, orderBy: { createdAt: "desc" }, take: 5 }) : Promise.resolve([]),
        sections.certificates ? db.certificate.count({ where: { status: "ACTIVE" } }) : zero,
        sections.certificates ? db.certificate.count({ where: { status: "ACTIVE", createdAt: { gte: month } } }) : zero,
        sections.emails ? db.monitoredEmail.count({ where: { hasNewBreach: true } }) : zero,
        isAdmin ? db.auditLog.count({ where: { createdAt: { gte: since }, action: { in: ["auth.login_failed", "auth.2fa_failed"] } } }) : zero,
        isAdmin ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { actor: { select: { name: true } } } }) : Promise.resolve([]),
    ]);
    const noSections = !sections.sites && !sections.emails && !sections.certificates;

    return (
        <>
            <PageHeader title={`أهلاً، ${user.name}`} description="نظرة سريعة على اللوحة." />
            {sp.password === "changed" && (
                <div className="mb-6">
                    <Alert tone="success">تم تغيير كلمة المرور، وتم تسجيل خروجك من الأجهزة الأخرى.</Alert>
                </div>
            )}
            {sp.denied && (
                <div className="mb-6">
                    <Alert>ليس لديك صلاحية على هذا القسم. اطلبها من المدير.</Alert>
                </div>
            )}
            {noSections && (
                <div className="mb-6">
                    <Alert tone="info">لم تُعطَ صلاحية على أي قسم بعد. اطلب من المدير تفعيل الأقسام اللي بتشتغل عليها.</Alert>
                </div>
            )}

            {isAdmin && (
                <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Tile href="/security?status=NEW">
                        <Stat label="طلبات فحص جديدة" value={newCount} hint="لم تُسند لأحد بعد" />
                    </Tile>
                    <Tile href="/security?status=open">
                        <Stat label="ملفات قيد العمل" value={openCount} />
                    </Tile>
                    <Stat label="طلبات آخر 7 أيام" value={weekCount} />
                    <Stat
                        label="نسبة التحويل لعملاء"
                        value={monthScans ? `${Math.round((monthConverted / monthScans) * 100)}%` : "—"}
                        hint={`آخر 30 يوماً · ${monthConverted} من ${monthScans} طلب`}
                    />
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-6">
                    {sections.sites && (
                        <Card>
                            <CardHeader
                                title="ملفاتي المفتوحة"
                                description="طلبات الفحص المسندة لك ولم تُقفل بعد."
                                action={
                                    <Link href="/security?mine=1" className="text-sm text-primary hover:underline">
                                        الكل
                                    </Link>
                                }
                            />
                            <ul className="divide-y divide-line">
                                {myFiles.map((r) => {
                                    const late = r.dueAt && r.dueAt < now;
                                    return (
                                        <li key={r.id}>
                                            <Link href={`/security/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-muted/60">
                                                <span className="min-w-0">
                                                    <span className="font-medium">#{r.id}</span>{" "}
                                                    <span className="ltr">{r.target?.replace(/^https?:\/\//, "") ?? r.email}</span>
                                                    <span className="text-muted-foreground"> · {r._count.findings} ثغرة</span>
                                                </span>
                                                <span className="flex items-center gap-2">
                                                    <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                                                    {r.dueAt && (
                                                        <span className={cn("text-xs", late ? "font-medium text-red-600" : "text-muted-foreground")}>
                                                            {late ? "متأخر · " : "التسليم "}
                                                            {formatDateTime(r.dueAt).split("،")[0]}
                                                        </span>
                                                    )}
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                                {myFiles.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد ملفات مفتوحة مسندة لك.</li>}
                            </ul>
                        </Card>
                    )}

                    {isAdmin && (
                        <Card>
                            <CardHeader
                                title="طلبات جديدة بانتظار الإسناد"
                                action={
                                    <Link href="/security" className="text-sm text-primary hover:underline">
                                        كل الطلبات
                                    </Link>
                                }
                            />
                            <ul className="divide-y divide-line">
                                {latest.map((r) => (
                                    <li key={r.id}>
                                        <Link href={`/security/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-muted/60">
                                            <span>
                                                <span className="font-medium">#{r.id}</span> · {r.name ?? r.email}
                                                <span className="text-muted-foreground"> · {TYPE_LABELS[r.type]}</span>
                                            </span>
                                            <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                                        </Link>
                                    </li>
                                ))}
                                {latest.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد طلبات جديدة.</li>}
                            </ul>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    {sections.emails && (
                        <Tile href="/security/emails?show=new">
                            <Card className={cn("flex gap-4 p-5 hover:bg-muted/40", breachAlerts && "border-red-200")}>
                                <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", breachAlerts ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary")}>
                                    <MailWarning className="size-5" aria-hidden />
                                </div>
                                <div>
                                    <p className="font-semibold">مراقبة الإيميلات</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{breachAlerts ? `${breachAlerts} إيميل فيه تسريب جديد لم يُراجع.` : "لا تسريبات جديدة."}</p>
                                </div>
                            </Card>
                        </Tile>
                    )}
                    {sections.certificates && (
                        <Tile href="/certificates">
                            <Card className="flex gap-4 p-5 hover:bg-muted/40">
                                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                    <Award className="size-5" aria-hidden />
                                </div>
                                <div>
                                    <p className="font-semibold">الشهادات</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {certCount} شهادة صالحة، منها {certMonth} في آخر 30 يوماً.
                                    </p>
                                </div>
                            </Card>
                        </Tile>
                    )}
                    {isAdmin && <Stat label="محاولات دخول فاشلة" value={failedToday} hint="آخر 24 ساعة" />}
                </div>
            </div>

            {isAdmin && (
                <Card className="mt-6">
                    <CardHeader
                        title="آخر العمليات"
                        action={
                            <Link href="/settings/audit" className="text-sm text-primary hover:underline">
                                السجل الكامل
                            </Link>
                        }
                    />
                    <ul className="divide-y divide-line">
                        {recent.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                                <span>
                                    <span className="font-medium">{r.actor?.name ?? "—"}</span>
                                    <span className="text-muted-foreground"> · {AUDIT_LABELS[r.action] ?? r.action}</span>
                                </span>
                                <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </>
    );
}
