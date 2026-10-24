import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { checkNowAction, markReviewedAction, removeEmailAction, updateEmailAction } from "../actions";
import { ConfirmRemove } from "./confirm-remove";

export const metadata: Metadata = { title: "إيميل تحت المراقبة" };

type BreachItem = { name: string; date?: string };

export default async function MonitoredEmailPage({ params }: { params: Promise<{ id: string }> }) {
    await requireSection("emails");
    const { id } = await params;
    const m = await db.monitoredEmail.findUnique({
        where: { id },
        include: { checks: { orderBy: { checkedAt: "desc" }, take: 30 }, addedBy: { select: { name: true } } },
    });
    if (!m) notFound();
    const latestOk = m.checks.find((c) => !c.error);
    const exposed = (latestOk?.exposed as string[] | null) ?? [];
    const known = (m.knownBreaches as string[] | null) ?? [];

    return (
        <>
            <Link href="/security/emails" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                مراقبة الإيميلات
            </Link>

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <h1 className="ltr text-2xl font-bold break-all">{m.email}</h1>
                {m.status === "PAUSED" ? <Badge>متوقف</Badge> : <Badge tone="primary">{m.frequency === "WEEKLY" ? "فحص أسبوعي" : "فحص شهري"}</Badge>}
            </div>

            {m.hasNewBreach && (
                <div className="mb-6">
                    <Alert>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span>ظهر هذا الإيميل في تسريب جديد بتاريخ {formatDateTime(m.lastNewBreachAt)}. راجع السجل تحت، وتواصل مع صاحبه إذا لزم.</span>
                            <form action={markReviewedAction}>
                                <input type="hidden" name="id" value={m.id} />
                                <SubmitButton size="sm" variant="secondary" pendingText="…">
                                    تمت المراجعة
                                </SubmitButton>
                            </form>
                        </div>
                    </Alert>
                </div>
            )}
            {m.lastError && (
                <div className="mb-6">
                    <Alert tone="info">{m.lastError}</Alert>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <div className="min-w-0 space-y-6">
                    <Card>
                        <CardHeader title="الوضع الحالي" />
                        <dl className="divide-y divide-line text-sm">
                            {[
                                ["عدد التسريبات", m.lastCheckedAt ? String(m.breachCount) : "لم يُفحص بعد"],
                                ["البيانات المكشوفة", exposed.length ? exposed.join("، ") : "—"],
                                ["آخر فحص", formatDateTime(m.lastCheckedAt)],
                                ["الفحص القادم", m.status === "PAUSED" ? "متوقف" : formatDateTime(m.nextCheckAt)],
                                ["المصدر", m.source === "manual" ? `أضافه ${m.addedBy?.name ?? "موظف"}` : "اشتراك من zad.gg/security"],
                                ["تحت المراقبة منذ", formatDateTime(m.createdAt)],
                            ].map(([k, v]) => (
                                <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-5 py-3">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd>{v}</dd>
                                </div>
                            ))}
                        </dl>
                        {known.length > 0 && (
                            <div className="border-t border-line px-5 py-4">
                                <p className="mb-2 text-sm text-muted-foreground">كل التسريبات المعروفة</p>
                                <div className="ltr flex flex-wrap gap-1.5">
                                    {known.map((k) => (
                                        <span key={k} className="rounded bg-muted px-2 py-0.5 text-xs">
                                            {k}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <CardHeader title="سجل الفحوصات" description="آخر 30 فحصاً." />
                        <ul className="divide-y divide-line">
                            {m.checks.map((c, i) => {
                                const items = (c.newBreaches as BreachItem[] | null) ?? [];
                                const first = i === m.checks.length - 1 && m.checks.length < 30;
                                return (
                                    <li key={c.id} className="px-5 py-3 text-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-muted-foreground">{formatDateTime(c.checkedAt)}</span>
                                            {c.error ? (
                                                <Badge>تعذّر الفحص</Badge>
                                            ) : items.length && !first ? (
                                                <Badge tone="danger">{items.length} تسريب جديد</Badge>
                                            ) : (
                                                <Badge tone={c.breachCount ? "warning" : "success"}>{first ? `أول فحص · ${c.breachCount} تسريب` : "لا جديد"}</Badge>
                                            )}
                                        </div>
                                        {!c.error && items.length > 0 && (
                                            <p className="ltr mt-1.5 text-start text-xs text-muted-foreground">
                                                {items.map((b) => (b.date ? `${b.name} (${b.date})` : b.name)).join(" · ")}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                            {m.checks.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">لم يُفحص بعد.</li>}
                        </ul>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="p-5">
                        <form action={checkNowAction}>
                            <input type="hidden" name="id" value={m.id} />
                            <SubmitButton className="w-full" pendingText="جارٍ الفحص…">
                                افحص الآن
                            </SubmitButton>
                        </form>
                    </Card>

                    <Card className="p-5">
                        <form action={updateEmailAction} className="space-y-3">
                            <input type="hidden" name="id" value={m.id} />
                            <div>
                                <Label htmlFor="frequency">تكرار الفحص</Label>
                                <Select id="frequency" name="frequency" defaultValue={m.frequency}>
                                    <option value="WEEKLY">أسبوعي</option>
                                    <option value="MONTHLY">شهري</option>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="status">الحالة</Label>
                                <Select id="status" name="status" defaultValue={m.status}>
                                    <option value="ACTIVE">تحت المراقبة</option>
                                    <option value="PAUSED">متوقف</option>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="note">ملاحظة</Label>
                                <textarea
                                    id="note"
                                    name="note"
                                    defaultValue={m.note ?? ""}
                                    maxLength={500}
                                    rows={2}
                                    className="w-full rounded-lg border border-line bg-white p-2 text-sm"
                                />
                            </div>
                            <SubmitButton variant="secondary" size="sm" className="w-full" pendingText="جارٍ الحفظ…">
                                حفظ
                            </SubmitButton>
                        </form>
                    </Card>

                    <Card className="p-5">
                        <ConfirmRemove id={m.id} action={removeEmailAction} />
                    </Card>
                </div>
            </div>
        </>
    );
}
