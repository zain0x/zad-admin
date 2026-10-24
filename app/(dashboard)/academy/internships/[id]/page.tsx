import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Award, FileText, Mail, MessageCircle, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection, can } from "@/lib/auth/permissions";
import { INTERNSHIP_ORDER, INTERNSHIP_STATUS } from "@/lib/academy";
import { AUDIT_LABELS } from "@/lib/audit";
import { cn, formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { updateStatusAction } from "../actions";
import { DetailsForm, IssueCertForm, NoteForm } from "./forms";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ issued?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return { title: `طلب تدريب #${(await params).id}` };
}

function whatsapp(phone: string, name: string) {
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("07") && digits.length === 10) digits = `962${digits.slice(1)}`;
    if (digits.length < 9 || digits.length > 15) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(`مرحباً ${name}، معك فريق أكاديمية زاد بخصوص طلب التدريب.`)}`;
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

function Row({ label, children, ltr }: { label: string; children: React.ReactNode; ltr?: boolean }) {
    return (
        <div className="grid grid-cols-[120px_1fr] gap-3 px-5 py-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={ltr ? "ltr text-start break-all" : ""}>{children}</dd>
        </div>
    );
}

export default async function InternshipPage({ params, searchParams }: Props) {
    const { user } = await requireSection("internships");
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) notFound();
    const sp = await searchParams;

    const [a, staff, history] = await Promise.all([
        db.internshipApplication.findUnique({
            where: { id },
            include: { notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } } },
        }),
        db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        db.auditLog.findMany({ where: { targetType: "internship", targetId: String(id) }, orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } }),
    ]);
    if (!a) notFound();
    const cert = a.certificateId ? await db.certificate.findUnique({ where: { id: a.certificateId }, select: { id: true, code: true, status: true } }) : null;
    const wa = whatsapp(a.phone, a.nameAr);
    const st = INTERNSHIP_STATUS[a.status];

    return (
        <>
            <Link href="/academy/internships" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                طلبات التدريب
            </Link>

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{a.nameAr}</h1>
                <Badge tone={st.tone}>{st.label}</Badge>
                <span className="text-sm text-muted-foreground">
                    طلب #{a.id} · {a.field}
                </span>
            </div>

            {sp.issued && cert && (
                <div className="mb-6">
                    <Alert tone="success">تم إصدار شهادة التدريب برقم {cert.code}.</Alert>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <div className="min-w-0 space-y-6">
                    <Card>
                        <CardHeader title="بيانات الطالب" />
                        <dl className="divide-y divide-line">
                            <Row label="الاسم">{a.nameAr}</Row>
                            <Row label="البريد" ltr>
                                {a.email}
                            </Row>
                            <Row label="الهاتف" ltr>
                                {a.phone}
                            </Row>
                            <Row label="الجامعة">{a.university}</Row>
                            <Row label="التخصص">{a.major || "—"}</Row>
                            <Row label="المجال المطلوب">{a.field}</Row>
                            <Row label="وصل في">{formatDateTime(a.createdAt)}</Row>
                        </dl>
                        <div className="flex flex-wrap gap-2 border-t border-line p-4">
                            <a href={`mailto:${a.email}`} className={buttonClass("secondary", "sm")}>
                                <Mail className="size-4" aria-hidden />
                                إيميل
                            </a>
                            <a href={`tel:${a.phone}`} className={buttonClass("secondary", "sm")}>
                                <Phone className="size-4" aria-hidden />
                                اتصال
                            </a>
                            {wa && (
                                <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                                    <MessageCircle className="size-4" aria-hidden />
                                    واتساب
                                </a>
                            )}
                            {a.cvKey && (
                                <a href={`/academy/internships/${a.id}/cv`} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "sm")}>
                                    <FileText className="size-4" aria-hidden />
                                    السيرة الذاتية
                                </a>
                            )}
                        </div>
                    </Card>

                    {a.bio && (
                        <Card>
                            <CardHeader title="عن نفسه" />
                            <p className="p-5 text-sm leading-7 whitespace-pre-wrap">{a.bio}</p>
                        </Card>
                    )}

                    <Card>
                        <CardHeader title="الملاحظات" />
                        <div className="space-y-4 p-5">
                            <NoteForm id={a.id} />
                            {a.notes.map((n) => (
                                <div key={n.id} className="rounded-lg bg-muted/60 p-3">
                                    <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {n.author?.name ?? "—"} · {formatDateTime(n.createdAt)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {history.length > 0 && (
                        <Card>
                            <CardHeader title="السجل" />
                            <ol className="divide-y divide-line text-sm">
                                {history.map((h) => {
                                    const d = (h.details ?? {}) as Record<string, string>;
                                    const extra =
                                        h.action === "internship.status_changed"
                                            ? `${INTERNSHIP_STATUS[d.from as keyof typeof INTERNSHIP_STATUS]?.label ?? d.from} ← ${INTERNSHIP_STATUS[d.to as keyof typeof INTERNSHIP_STATUS]?.label ?? d.to}`
                                            : (d.code ?? "");
                                    return (
                                        <li key={h.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                                            <span>
                                                {AUDIT_LABELS[h.action] ?? h.action} {extra && <span className="text-muted-foreground">· {extra}</span>}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {h.actor?.name ?? "الموقع"} · {formatDateTime(h.createdAt)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader title="الحالة" />
                        <div className="grid grid-cols-2 gap-2 p-5">
                            {INTERNSHIP_ORDER.map((s) => (
                                <form key={s} action={updateStatusAction}>
                                    <input type="hidden" name="applicationId" value={a.id} />
                                    <input type="hidden" name="status" value={s} />
                                    <button
                                        type="submit"
                                        disabled={a.status === s}
                                        className={cn(
                                            "w-full rounded-lg border px-2 py-2 text-xs",
                                            a.status === s ? "border-primary bg-primary text-white" : "border-line bg-white hover:bg-muted"
                                        )}
                                    >
                                        {INTERNSHIP_STATUS[s].label}
                                    </button>
                                </form>
                            ))}
                        </div>
                    </Card>

                    <Card>
                        <CardHeader title="بيانات التدريب" />
                        <DetailsForm
                            id={a.id}
                            staff={staff}
                            initial={{
                                nameEn: a.nameEn,
                                gender: a.gender,
                                supervisorId: a.supervisorId ?? "",
                                department: a.department ?? "",
                                startDate: day(a.startDate),
                                endDate: day(a.endDate),
                                hours: a.hours ? String(a.hours) : "",
                            }}
                        />
                    </Card>

                    <Card>
                        <CardHeader title="شهادة التدريب" />
                        <div className="p-5">
                            {cert ? (
                                <div className="space-y-3 text-sm">
                                    <p className="flex items-center gap-2">
                                        <Award className="size-4 text-primary" aria-hidden />
                                        <span className="ltr font-mono">{cert.code}</span>
                                        {cert.status === "REVOKED" && <Badge tone="danger">ملغاة</Badge>}
                                    </p>
                                    {can(user, "certificates") && (
                                        <Link href={`/certificates/${cert.id}`} className={buttonClass("secondary", "sm")}>
                                            فتح الشهادة
                                        </Link>
                                    )}
                                </div>
                            ) : a.status === "COMPLETED" ? (
                                <IssueCertForm id={a.id} />
                            ) : (
                                <p className="text-sm text-muted-foreground">بتقدر تصدر الشهادة لما تصير الحالة «أنهى التدريب» وتكمل الاسم بالإنجليزي والقسم والتواريخ والساعات.</p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}
