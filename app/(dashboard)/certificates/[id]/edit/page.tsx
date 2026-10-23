import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { isoDate } from "@/lib/certificates/format";
import type { CertDetails } from "@/lib/certificates/types";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { CertForm } from "../../cert-form";

export const metadata: Metadata = { title: "تعديل شهادة" };

export default async function EditCertificatePage({ params }: { params: Promise<{ id: string }> }) {
    await requireUser();
    const { id } = await params;
    const c = await db.certificate.findUnique({ where: { id } });
    if (!c) notFound();
    return (
        <>
            <Link href={`/certificates/${c.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                {c.code}
            </Link>
            <PageHeader title="تعديل شهادة" description="الرقم ورمز QR يبقيان كما هما، وكل تعديل يُسجّل في سجل العمليات." />
            <div className="mb-6 max-w-3xl">
                <Alert tone="info">إذا كان صاحب الشهادة استلمها، أرسل له النسخة الجديدة بعد التعديل.</Alert>
            </div>
            <div className="max-w-3xl">
                <CertForm
                    initial={{
                        id: c.id,
                        type: c.type,
                        nameAr: c.nameAr,
                        nameEn: c.nameEn,
                        gender: c.gender,
                        email: c.email ?? "",
                        issuedAt: isoDate(c.issuedAt),
                        details: c.details as CertDetails,
                    }}
                />
            </div>
        </>
    );
}
