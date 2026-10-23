import Link from "next/link";
import { Award } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { AUDIT_LABELS } from "@/lib/audit";
import { OPEN_STATUSES, STATUS_LABELS, STATUS_TONES, TYPE_LABELS } from "@/lib/requests";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <Card className="p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </Card>
    );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
    const { user } = await requireUser();
    const { password } = await searchParams;
    const isAdmin = user.role === "ADMIN";
    const since = new Date(Date.now() - 24 * 3600_000);
    const week = new Date(Date.now() - 7 * 24 * 3600_000);
    const month = new Date(Date.now() - 30 * 24 * 3600_000);
    const scans = { type: { in: ["SITE", "LEAK"] as ("SITE" | "LEAK")[] } };

    const [newCount, weekCount, openCount, mineOpen, monthScans, monthConverted, latest, failedToday, recent] = await Promise.all([
        db.scanRequest.count({ where: { status: "NEW" } }),
        db.scanRequest.count({ where: { createdAt: { gte: week } } }),
        db.scanRequest.count({ where: { status: { in: OPEN_STATUSES } } }),
        db.scanRequest.count({ where: { status: { in: OPEN_STATUSES }, assigneeId: user.id } }),
        db.scanRequest.count({ where: { ...scans, createdAt: { gte: month } } }),
        db.scanRequest.count({ where: { ...scans, createdAt: { gte: month }, status: "CONVERTED" } }),
        db.scanRequest.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 5 }),
        db.auditLog.count({ where: { createdAt: { gte: since }, action: { in: ["auth.login_failed", "auth.2fa_failed"] } } }),
        isAdmin
            ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { actor: { select: { name: true } } } })
            : Promise.resolve([]),
    ]);

    return (
        <>
            <PageHeader title={`أهلاً، ${user.name}`} description="نظرة سريعة على اللوحة." />
            {password === "changed" && (
                <div className="mb-6">
                    <Alert tone="success">تم تغيير كلمة المرور، وتم تسجيل خروجك من الأجهزة الأخرى.</Alert>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Link href="/security?status=NEW" className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
                    <Stat label="طلبات جديدة" value={newCount} hint="لم يتواصل معها أحد" />
                </Link>
                <Link href="/security?status=open&mine=1" className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
                    <Stat label="قيد المتابعة" value={openCount} hint={`منها ${mineOpen} معك`} />
                </Link>
                <Stat label="طلبات آخر 7 أيام" value={weekCount} />
                <Stat
                    label="نسبة التحويل لعملاء"
                    value={monthScans ? `${Math.round((monthConverted / monthScans) * 100)}%` : "—"}
                    hint={`آخر 30 يوماً · ${monthConverted} من ${monthScans} طلب فحص`}
                />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
                <Card>
                    <CardHeader
                        title="أحدث الطلبات الجديدة"
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
                                    <span className="flex items-center gap-2">
                                        <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                                        <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                        {latest.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">لا توجد طلبات جديدة.</li>}
                    </ul>
                </Card>

                <div className="space-y-4">
                    {isAdmin && <Stat label="محاولات دخول فاشلة" value={failedToday} hint="آخر 24 ساعة" />}
                    <Card className="flex gap-4 p-5">
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Award className="size-5" aria-hidden />
                        </div>
                        <div>
                            <p className="font-semibold">
                                الشهادات <span className="ms-1 text-xs font-normal text-muted-foreground">· المرحلة 3</span>
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">إصدار شهادات التدريب والمحاضرات والكورسات والتحقق منها.</p>
                        </div>
                    </Card>
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
                        {recent.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted-foreground">لا توجد عمليات بعد.</li>}
                    </ul>
                </Card>
            )}
        </>
    );
}
