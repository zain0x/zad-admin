import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, ExternalLink, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { AUDIT_LABELS } from "@/lib/audit";
import { arDate } from "@/lib/certificates/format";
import { verifyUrl } from "@/lib/certificates/template";
import { TYPE_LABELS, TYPE_TITLES, describe, type CertDetails } from "@/lib/certificates/types";
import { formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { restoreCertificateAction } from "../actions";
import { CopyButton } from "./copy-button";
import { RevokeForm } from "./revoke-form";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ issued?: string; updated?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const c = await db.certificate.findUnique({ where: { id: (await params).id }, select: { code: true } });
    return { title: c?.code ?? "شهادة" };
}

function linkedInUrl(c: { code: string; type: keyof typeof TYPE_TITLES; issuedAt: Date; details: CertDetails }) {
    const name = c.details.titleEn || c.details.titleAr || TYPE_TITLES[c.type].en;
    const p = new URLSearchParams({
        startTask: "CERTIFICATION_NAME",
        name,
        organizationName: "Zad",
        issueYear: String(c.issuedAt.getUTCFullYear()),
        issueMonth: String(c.issuedAt.getUTCMonth() + 1),
        certUrl: verifyUrl(c.code),
        certId: c.code,
    });
    return `https://www.linkedin.com/profile/add?${p}`;
}

export default async function CertificatePage({ params, searchParams }: Props) {
    await requireSection("certificates");
    const { id } = await params;
    const sp = await searchParams;
    const [c, history] = await Promise.all([
        db.certificate.findUnique({ where: { id }, include: { issuedBy: { select: { name: true } }, revokedBy: { select: { name: true } } } }),
        db.auditLog.findMany({ where: { targetType: "certificate", targetId: id }, orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } }),
    ]);
    if (!c) notFound();
    const details = c.details as CertDetails;
    const info = describe(c.type, c.gender, details);
    const url = verifyUrl(c.code);
    const active = c.status === "ACTIVE";

    return (
        <>
            <Link href="/certificates" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                الشهادات
            </Link>

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <h1 className="ltr text-2xl font-bold">{c.code}</h1>
                <Badge tone={active ? "success" : "danger"}>{active ? "صالحة" : "ملغاة"}</Badge>
                <span className="text-sm text-muted-foreground">شهادة {TYPE_LABELS[c.type]}</span>
            </div>

            {sp.issued && (
                <div className="mb-6">
                    <Alert tone="success">تم إصدار الشهادة. حمّلها PDF أو انسخ رابط التحقق.</Alert>
                </div>
            )}
            {sp.updated && (
                <div className="mb-6">
                    <Alert tone="success">تم حفظ التعديلات.</Alert>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <div className="min-w-0 space-y-6">
                    <Card className="overflow-hidden">
                        <iframe
                            src={`/certificates/${c.id}/preview`}
                            title={`معاينة الشهادة ${c.code}`}
                            className="block aspect-[1123/794] w-full border-0 bg-muted"
                        />
                    </Card>

                    <Card>
                        <CardHeader title="التفاصيل" />
                        <dl className="divide-y divide-line text-sm">
                            {[
                                ["الاسم", `${c.nameEn} · ${c.nameAr}`],
                                ["الإيميل", c.email ?? "—"],
                                ...info.facts.map((f) => [f.ar, f.value || "—"]),
                                ...(info.skills.length ? [["المهارات", info.skills.join("، ")]] : []),
                                ["تاريخ الإصدار", arDate(c.issuedAt)],
                                ["أصدرها", `${c.issuedBy?.name ?? "—"} · ${formatDateTime(c.createdAt)}`],
                                ...(c.batchId ? [["إصدار جماعي", c.batchId]] : []),
                                ...(!active ? [["أُلغيت", `${c.revokedBy?.name ?? "—"} · ${formatDateTime(c.revokedAt)}${c.revokeReason ? ` · ${c.revokeReason}` : ""}`]] : []),
                            ].map(([k, v]) => (
                                <div key={k} className="grid grid-cols-[130px_1fr] gap-3 px-5 py-3">
                                    <dt className="text-muted-foreground">{k}</dt>
                                    <dd className="break-words">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="space-y-2 p-5">
                        {active && (
                            <a href={`/certificates/${c.id}/pdf`} className={buttonClass("primary", "md", "w-full")}>
                                <Download className="size-4" aria-hidden />
                                تحميل PDF
                            </a>
                        )}
                        <CopyButton text={url} label="نسخ رابط التحقق" />
                        {active && <CopyButton text={linkedInUrl({ ...c, details })} label="نسخ رابط LinkedIn" />}
                        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "md", "w-full")}>
                            <ExternalLink className="size-4" aria-hidden />
                            فتح صفحة التحقق
                        </a>
                        <p className="ltr pt-1 text-center text-xs break-all text-muted-foreground">{url}</p>
                    </Card>

                    <Card className="space-y-2 p-5">
                        <Link href={`/certificates/${c.id}/edit`} className={buttonClass("secondary", "md", "w-full")}>
                            <Pencil className="size-4" aria-hidden />
                            تعديل
                        </Link>
                        {active ? (
                            <RevokeForm id={c.id} />
                        ) : (
                            <form action={restoreCertificateAction}>
                                <input type="hidden" name="id" value={c.id} />
                                <SubmitButton variant="secondary" className="w-full" pendingText="جارٍ التفعيل…">
                                    إعادة تفعيل الشهادة
                                </SubmitButton>
                            </form>
                        )}
                    </Card>

                    <Card>
                        <CardHeader title="السجل" />
                        <ol className="space-y-3 p-5">
                            {history.map((h) => (
                                <li key={h.id} className="border-s-2 border-line ps-3 text-sm">
                                    <p>{AUDIT_LABELS[h.action] ?? h.action}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {h.actor?.name ?? "—"} · {formatDateTime(h.createdAt)}
                                    </p>
                                </li>
                            ))}
                            {history.length === 0 && <li className="text-sm text-muted-foreground">{c.batchId ? "صدرت ضمن إصدار جماعي." : "—"}</li>}
                        </ol>
                    </Card>
                </div>
            </div>
        </>
    );
}
