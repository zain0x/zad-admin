import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { AUDIT_LABELS } from "@/lib/audit";
import { STATUS_LABELS, STATUS_ORDER, STATUS_TONES, TYPE_LABELS, whatsappLink } from "@/lib/requests";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { assignAction, updateStatusAction } from "../actions";
import { NoteForm } from "./note-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return { title: `طلب #${(await params).id}` };
}

function Row({ label, children, ltr }: { label: string; children: React.ReactNode; ltr?: boolean }) {
    return (
        <div className="grid grid-cols-[120px_1fr] gap-3 px-5 py-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={ltr ? "ltr text-start break-all" : ""}>{children}</dd>
        </div>
    );
}

export default async function RequestPage({ params }: Props) {
    const { user } = await requireUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) notFound();

    const [r, staff, history] = await Promise.all([
        db.scanRequest.findUnique({
            where: { id },
            include: {
                assignee: { select: { id: true, name: true } },
                notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
            },
        }),
        db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        db.auditLog.findMany({
            where: { targetType: "scan_request", targetId: String(id) },
            orderBy: { createdAt: "asc" },
            include: { actor: { select: { name: true } } },
        }),
    ]);
    if (!r) notFound();

    const staffName = (sid: unknown) => staff.find((s) => s.id === sid)?.name ?? "—";
    const wa = whatsappLink(r.phone, r.name, r.target?.replace(/^https?:\/\//, "") ?? null);
    const describe = (h: (typeof history)[number]) => {
        const d = (h.details ?? {}) as Record<string, string>;
        if (h.action === "request.status_changed") return `${STATUS_LABELS[d.from as keyof typeof STATUS_LABELS] ?? d.from} ← ${STATUS_LABELS[d.to as keyof typeof STATUS_LABELS] ?? d.to}`;
        if (h.action === "request.assigned") return d.to === "none" ? "بدون مسؤول" : staffName(d.to);
        return "";
    };

    return (
        <>
            <Link href="/security" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                كل الطلبات
            </Link>

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">طلب #{r.id}</h1>
                <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                <span className="text-sm text-muted-foreground">{TYPE_LABELS[r.type]}</span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-6">
                    <Card>
                        <CardHeader title="تفاصيل الطلب" />
                        <dl className="divide-y divide-line">
                            <Row label="الاسم">{r.name ?? "—"}</Row>
                            <Row label="البريد" ltr>
                                {r.email}
                            </Row>
                            <Row label="الهاتف" ltr>
                                {r.phone ?? "—"}
                            </Row>
                            {r.target && (
                                <Row label="الموقع" ltr>
                                    <a href={r.target} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
                                        {r.target}
                                        <ExternalLink className="size-3.5" aria-hidden />
                                    </a>
                                </Row>
                            )}
                            {r.type !== "NOTIFY" && <Row label="تأكيد الملكية">{r.authorized ? "أكّد أنه مالك الموقع أو مفوّض" : "لم يؤكد"}</Row>}
                            <Row label="وصل في">{formatDateTime(r.createdAt)}</Row>
                            <Row label="المصدر" ltr>
                                {[r.source, r.ip].filter(Boolean).join(" · ") || "—"}
                            </Row>
                        </dl>
                    </Card>

                    <Card>
                        <CardHeader title="الملاحظات" description="داخلية، لا يراها العميل." />
                        <div className="p-5">
                            <NoteForm requestId={r.id} />
                            <ul className="mt-5 space-y-4">
                                {r.notes.map((n) => (
                                    <li key={n.id} className="rounded-lg bg-muted p-3">
                                        <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {n.author?.name ?? "—"} · {formatDateTime(n.createdAt)}
                                        </p>
                                    </li>
                                ))}
                                {r.notes.length === 0 && <li className="text-sm text-muted-foreground">لا توجد ملاحظات بعد.</li>}
                            </ul>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="space-y-2 p-5">
                        {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md", "w-full")}>
                                <MessageCircle className="size-4" aria-hidden />
                                مراسلة على واتساب
                            </a>
                        )}
                        <a href={`mailto:${r.email}`} className={buttonClass("secondary", "md", "w-full")}>
                            <Mail className="size-4" aria-hidden />
                            مراسلة بالإيميل
                        </a>
                    </Card>

                    <Card className="p-5">
                        <form action={updateStatusAction} className="space-y-2">
                            <input type="hidden" name="requestId" value={r.id} />
                            <label htmlFor="status" className="block text-sm font-medium">
                                الحالة
                            </label>
                            <Select id="status" name="status" defaultValue={r.status}>
                                {STATUS_ORDER.map((s) => (
                                    <option key={s} value={s}>
                                        {STATUS_LABELS[s]}
                                    </option>
                                ))}
                            </Select>
                            <SubmitButton size="sm" variant="secondary" className="w-full" pendingText="جارٍ الحفظ…">
                                حفظ الحالة
                            </SubmitButton>
                        </form>

                        <form action={assignAction} className="mt-5 space-y-2">
                            <input type="hidden" name="requestId" value={r.id} />
                            <label htmlFor="assigneeId" className="block text-sm font-medium">
                                المسؤول
                            </label>
                            <Select id="assigneeId" name="assigneeId" defaultValue={r.assignee?.id ?? ""}>
                                <option value="">بدون مسؤول</option>
                                {staff.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                        {s.id === user.id ? " (أنت)" : ""}
                                    </option>
                                ))}
                            </Select>
                            <SubmitButton size="sm" variant="secondary" className="w-full" pendingText="جارٍ الحفظ…">
                                حفظ المسؤول
                            </SubmitButton>
                        </form>
                    </Card>

                    <Card>
                        <CardHeader title="السجل" />
                        <ol className="space-y-3 p-5">
                            {history.map((h) => (
                                <li key={h.id} className="border-s-2 border-line ps-3 text-sm">
                                    <p>
                                        {AUDIT_LABELS[h.action] ?? h.action}
                                        {describe(h) && <span className="text-muted-foreground">: {describe(h)}</span>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {h.actor?.name ?? "الموقع"} · {formatDateTime(h.createdAt)}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    </Card>
                </div>
            </div>
        </>
    );
}
