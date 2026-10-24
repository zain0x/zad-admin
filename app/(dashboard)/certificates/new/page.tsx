import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSection } from "@/lib/auth/permissions";
import { todayIso } from "@/lib/certificates/format";
import { PageHeader } from "@/components/page-header";
import { CertForm } from "../cert-form";

export const metadata: Metadata = { title: "إصدار شهادة" };

export default async function NewCertificatePage() {
    await requireSection("certificates");
    return (
        <>
            <Link href="/certificates" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                الشهادات
            </Link>
            <PageHeader title="إصدار شهادة" description="لشخص واحد. لعدة أشخاص دفعة واحدة استخدم الإصدار الجماعي." />
            <div className="max-w-3xl">
                <CertForm initial={{ type: "INTERNSHIP", nameAr: "", nameEn: "", gender: "MALE", email: "", issuedAt: todayIso(), details: {} }} />
            </div>
        </>
    );
}
