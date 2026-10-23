import Link from "next/link";
import { Award, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { AUDIT_LABELS } from "@/lib/audit";
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

    const [activeStaff, actionsToday, failedToday, mySessions, recent] = await Promise.all([
        db.user.count({ where: { isActive: true } }),
        db.auditLog.count({ where: { createdAt: { gte: since } } }),
        db.auditLog.count({ where: { createdAt: { gte: since }, action: { in: ["auth.login_failed", "auth.2fa_failed"] } } }),
        db.session.count({ where: { userId: user.id, twoFactorPassed: true, expiresAt: { gt: new Date() } } }),
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
                <Stat label="الموظفون النشطون" value={activeStaff} />
                <Stat label="عمليات آخر 24 ساعة" value={actionsToday} />
                <Stat label="محاولات دخول فاشلة" value={failedToday} hint="آخر 24 ساعة" />
                <Stat label="جلساتك النشطة" value={mySessions} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                    { icon: ShieldCheck, title: "Zad Security", text: "طلبات فحص المواقع والتسريبات من zad.gg/security تظهر هنا.", phase: "المرحلة 2" },
                    { icon: Award, title: "الشهادات", text: "إصدار شهادات التدريب والمحاضرات والكورسات والتحقق منها.", phase: "المرحلة 3" },
                ].map(({ icon: Icon, title, text, phase }) => (
                    <Card key={title} className="flex gap-4 p-5">
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="size-5" aria-hidden />
                        </div>
                        <div>
                            <p className="font-semibold">
                                {title} <span className="ms-1 text-xs font-normal text-muted-foreground">· {phase}</span>
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                        </div>
                    </Card>
                ))}
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
