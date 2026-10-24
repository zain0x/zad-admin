import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, ExternalLink, FileText, Lock, Mail, MessageCircle, Paperclip } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { AUDIT_LABELS } from "@/lib/audit";
import { SEVERITY, SEVERITY_ORDER, STATUS_LABELS, STATUS_ORDER, STATUS_TONES, TYPE_LABELS, canSeeRequest, whatsappLink } from "@/lib/requests";
import { ACCEPT_ATTR, formatBytes } from "@/lib/uploads";
import { cn, formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { assignAction, deleteFileAction, deleteFindingAction, reopenRequestAction, toggleFindingAction, updateStatusAction } from "../actions";
import { CloseForm } from "./close-form";
import { ConfirmButton } from "./confirm-button";
import { FindingForm } from "./finding-form";
import { NoteForm } from "./note-form";
import { UploadForm } from "./upload-form";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

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

const isoDay = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(d) : "");

export default async function RequestPage({ params, searchParams }: Props) {
    const { user } = await requireSection("sites");
    const isAdmin = user.role === "ADMIN";
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) notFound();
    const sp = await searchParams;

    const [r, staff, history] = await Promise.all([
        db.scanRequest.findUnique({
            where: { id },
            include: {
                assignee: { select: { id: true, name: true } },
                closedBy: { select: { name: true } },
                notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
                findings: { include: { author: { select: { name: true } } } },
                files: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
            },
        }),
        db.user.findMany({
            where: { isActive: true, OR: [{ role: "ADMIN" }, { permSites: true }] },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
        }),
        db.auditLog.findMany({ where: { targetType: "scan_request", targetId: String(id) }, orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } }),
    ]);
    if (!r || !canSeeRequest(user, r)) notFound();

    const open = !r.closedAt;
    const findings = [...r.findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    const overdue = open && r.dueAt && r.dueAt < new Date();
    const wa = whatsappLink(r.phone, r.name, r.target?.replace(/^https?:\/\//, "") ?? null);
    const staffName = (sid: unknown) => staff.find((s) => s.id === sid)?.name ?? "—";
    const describe = (h: (typeof history)[number]) => {
        const d = (h.details ?? {}) as Record<string, string>;
        if (h.action === "request.status_changed") return `${STATUS_LABELS[d.from as keyof typeof STATUS_LABELS] ?? d.from} ← ${STATUS_LABELS[d.to as keyof typeof STATUS_LABELS] ?? d.to}`;
        if (h.action === "request.assigned") return d.to === "none" ? "بدون مسؤول" : staffName(d.to);
        if (h.action.startsWith("request.finding") || h.action.startsWith("request.file")) return d.title ?? d.name ?? "";
        return "";
    };
    const hidden = <input type="hidden" name="requestId" value={r.id} />;

    return (
        <>
            <Link href="/security" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                فحص المواقع
            </Link>

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">طلب #{r.id}</h1>
                <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                {!open && (
                    <Badge>
                        <Lock className="me-1 size-3" aria-hidden />
                        الملف مقفل
                    </Badge>
                )}
                <span className="text-sm text-muted-foreground">{TYPE_LABELS[r.type]}</span>
                {r.dueAt && (
                    <span className={cn("text-sm", overdue ? "font-medium text-red-600" : "text-muted-foreground")}>
                        · التسليم {formatDateTime(r.dueAt).split("،")[0]} {overdue && "(متأخر)"}
                    </span>
                )}
            </div>

            {sp.created && (
                <div className="mb-6">
                    <Alert tone="success">تم إنشاء الطلب{r.assignee ? ` وإسناده لـ ${r.assignee.name}` : ""}.</Alert>
                </div>
            )}
            {!open && (
                <div className="mb-6">
                    <Alert tone="info">
                        <p className="font-medium">
                            أُقفل الملف بواسطة {r.closedBy?.name ?? "—"} في {formatDateTime(r.closedAt)}
                        </p>
                        {r.summary && <p className="mt-2 whitespace-pre-wrap">{r.summary}</p>}
                    </Alert>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-6">
                    <Card>
                        <CardHeader title="تفاصيل الطلب" />
                        <dl className="divide-y divide-line">
                            <Row label="العميل">{r.name ?? "—"}</Row>
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
                            <Row label="تأكيد الملكية">{r.authorized ? "أكّد أنه مالك الموقع أو مفوّض" : "لم يؤكد"}</Row>
                            <Row label="وصل في">
                                {formatDateTime(r.createdAt)} · {r.source === "manual" ? "أنشأه مدير" : "من الموقع"}
                            </Row>
                        </dl>
                    </Card>

                    {/* Findings */}
                    <Card>
                        <CardHeader
                            title={`الثغرات (${findings.length})`}
                            description="كل ما يُكتشف أثناء الفحص. تدخل تلقائياً في التقرير."
                            action={
                                <div className="flex flex-wrap gap-1">
                                    {SEVERITY_ORDER.map((s) => {
                                        const n = findings.filter((f) => f.severity === s).length;
                                        return n ? (
                                            <Badge key={s} tone={SEVERITY[s].tone}>
                                                {n} {SEVERITY[s].ar}
                                            </Badge>
                                        ) : null;
                                    })}
                                </div>
                            }
                        />
                        <ul className="divide-y divide-line">
                            {findings.map((f) => (
                                <li key={f.id} className="px-5 py-4">
                                    <details>
                                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                                            <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: SEVERITY[f.severity].color }}>
                                                {SEVERITY[f.severity].ar}
                                            </span>
                                            <span className={cn("font-medium", f.status === "FIXED" && "text-muted-foreground line-through")}>{f.title}</span>
                                            {f.status === "FIXED" && <Badge tone="success">تم الإصلاح</Badge>}
                                            <span className="ms-auto text-xs text-muted-foreground">{f.author?.name ?? "—"}</span>
                                        </summary>
                                        <div className="mt-3 space-y-3 text-sm">
                                            {f.affected && <p className="ltr rounded bg-muted px-2 py-1 font-mono text-xs break-all">{f.affected}</p>}
                                            <div>
                                                <p className="text-xs text-muted-foreground">الوصف</p>
                                                <p className="whitespace-pre-wrap">{f.description}</p>
                                            </div>
                                            {f.steps && (
                                                <div>
                                                    <p className="text-xs text-muted-foreground">خطوات إعادة الإنتاج</p>
                                                    <p className="whitespace-pre-wrap" dir="auto">
                                                        {f.steps}
                                                    </p>
                                                </div>
                                            )}
                                            {f.recommendation && (
                                                <div>
                                                    <p className="text-xs text-muted-foreground">التوصية</p>
                                                    <p className="whitespace-pre-wrap">{f.recommendation}</p>
                                                </div>
                                            )}
                                            {open && (
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    <form action={toggleFindingAction}>
                                                        {hidden}
                                                        <input type="hidden" name="findingId" value={f.id} />
                                                        <SubmitButton size="sm" variant="secondary" pendingText="…">
                                                            {f.status === "OPEN" ? "تم الإصلاح" : "إعادة فتح الثغرة"}
                                                        </SubmitButton>
                                                    </form>
                                                    <form action={deleteFindingAction}>
                                                        {hidden}
                                                        <input type="hidden" name="findingId" value={f.id} />
                                                        <ConfirmButton message={`حذف الثغرة "${f.title}"؟`} className={buttonClass("danger", "sm")}>
                                                            حذف
                                                        </ConfirmButton>
                                                    </form>
                                                </div>
                                            )}
                                            {open && (
                                                <details className="rounded-lg border border-line p-3">
                                                    <summary className="cursor-pointer text-sm text-primary">تعديل</summary>
                                                    <div className="mt-3">
                                                        <FindingForm requestId={r.id} finding={f} />
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    </details>
                                </li>
                            ))}
                            {findings.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted-foreground">لم تُسجّل ثغرات بعد.</li>}
                        </ul>
                        {open && (
                            <details className="border-t border-line px-5 py-4" open={findings.length === 0}>
                                <summary className="cursor-pointer font-medium text-primary">+ إضافة ثغرة</summary>
                                <div className="mt-4">
                                    <FindingForm requestId={r.id} />
                                </div>
                            </details>
                        )}
                    </Card>

                    {/* Files */}
                    <Card>
                        <CardHeader title={`الملفات (${r.files.length})`} description="تقارير، لقطات شاشة، أدلة. لا يراها إلا من يعمل على الطلب." />
                        <ul className="divide-y divide-line">
                            {r.files.map((f) => (
                                <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                    <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                    <a href={`/security/${r.id}/files/${f.id}`} className="min-w-0 flex-1 truncate text-primary hover:underline" dir="auto">
                                        {f.name}
                                    </a>
                                    <span className="text-xs text-muted-foreground">
                                        {formatBytes(f.size)} · {f.uploadedBy?.name ?? "—"} · {formatDateTime(f.createdAt)}
                                    </span>
                                    {open && (
                                        <form action={deleteFileAction}>
                                            {hidden}
                                            <input type="hidden" name="fileId" value={f.id} />
                                            <ConfirmButton message={`حذف الملف "${f.name}"؟`} className="text-xs text-red-700 hover:underline">
                                                حذف
                                            </ConfirmButton>
                                        </form>
                                    )}
                                </li>
                            ))}
                            {r.files.length === 0 && <li className="px-5 py-5 text-center text-sm text-muted-foreground">لا توجد ملفات.</li>}
                        </ul>
                        {open && (
                            <div className="border-t border-line px-5 py-4">
                                <UploadForm requestId={r.id} accept={ACCEPT_ATTR} />
                            </div>
                        )}
                    </Card>

                    {/* Notes */}
                    <Card>
                        <CardHeader title="الملاحظات" description="نصوص داخلية: ماذا تم، ماذا قال العميل، الخطوة القادمة." />
                        <div className="p-5">
                            {open && <NoteForm requestId={r.id} />}
                            <ul className={cn("space-y-4", open && "mt-5")}>
                                {r.notes.map((n) => (
                                    <li key={n.id} className="rounded-lg bg-muted p-3">
                                        <p className="text-sm whitespace-pre-wrap" dir="auto">
                                            {n.body}
                                        </p>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {n.author?.name ?? "—"} · {formatDateTime(n.createdAt)}
                                        </p>
                                    </li>
                                ))}
                                {r.notes.length === 0 && <li className="text-sm text-muted-foreground">لا توجد ملاحظات.</li>}
                            </ul>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="space-y-2 p-5">
                        <a href={`/security/${r.id}/report`} className={buttonClass("primary", "md", "w-full")}>
                            <Download className="size-4" aria-hidden />
                            تقرير الفحص PDF
                        </a>
                        <a href={`/security/${r.id}/report?view=html`} target="_blank" rel="noopener" className={buttonClass("ghost", "sm", "w-full")}>
                            <FileText className="size-4" aria-hidden />
                            معاينة التقرير
                        </a>
                    </Card>

                    <Card className="space-y-2 p-5">
                        {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md", "w-full")}>
                                <MessageCircle className="size-4" aria-hidden />
                                واتساب
                            </a>
                        )}
                        <a href={`mailto:${r.email}`} className={buttonClass("secondary", "md", "w-full")}>
                            <Mail className="size-4" aria-hidden />
                            إيميل
                        </a>
                    </Card>

                    <Card className="space-y-5 p-5">
                        <div>
                            <p className="mb-1.5 text-sm font-medium">المسؤول</p>
                            {isAdmin && open ? (
                                <form action={assignAction} className="space-y-2">
                                    {hidden}
                                    <Select name="assigneeId" defaultValue={r.assignee?.id ?? ""} aria-label="المسؤول">
                                        <option value="">بدون مسؤول</option>
                                        {staff.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                                {s.id === user.id ? " (أنت)" : ""}
                                            </option>
                                        ))}
                                    </Select>
                                    <label className="block text-xs text-muted-foreground">
                                        موعد التسليم
                                        <Input name="dueAt" type="date" defaultValue={isoDay(r.dueAt)} dir="ltr" className="mt-1" />
                                    </label>
                                    <SubmitButton size="sm" variant="secondary" className="w-full" pendingText="جارٍ الحفظ…">
                                        حفظ الإسناد
                                    </SubmitButton>
                                </form>
                            ) : (
                                <p className="text-sm">{r.assignee?.name ?? "—"}</p>
                            )}
                        </div>

                        {open && (
                            <form action={updateStatusAction} className="space-y-2">
                                {hidden}
                                <label htmlFor="status" className="block text-sm font-medium">
                                    مرحلة العمل
                                </label>
                                <Select id="status" name="status" defaultValue={r.status}>
                                    {STATUS_ORDER.filter((s) => s !== "CLOSED").map((s) => (
                                        <option key={s} value={s}>
                                            {STATUS_LABELS[s]}
                                        </option>
                                    ))}
                                </Select>
                                <SubmitButton size="sm" variant="secondary" className="w-full" pendingText="جارٍ الحفظ…">
                                    حفظ المرحلة
                                </SubmitButton>
                            </form>
                        )}
                    </Card>

                    <Card className="p-5">
                        {open ? (
                            <>
                                <p className="mb-3 font-semibold">إقفال الملف</p>
                                <CloseForm requestId={r.id} findings={findings.length} />
                            </>
                        ) : isAdmin ? (
                            <form action={reopenRequestAction}>
                                {hidden}
                                <SubmitButton variant="secondary" className="w-full" pendingText="…">
                                    إعادة فتح الملف
                                </SubmitButton>
                            </form>
                        ) : (
                            <p className="text-sm text-muted-foreground">الملف مقفل. المدير فقط يستطيع إعادة فتحه.</p>
                        )}
                    </Card>

                    <Card>
                        <CardHeader title="السجل" />
                        <ol className="max-h-96 space-y-3 overflow-y-auto p-5">
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
