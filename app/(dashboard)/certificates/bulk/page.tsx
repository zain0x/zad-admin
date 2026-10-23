import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { todayIso } from "@/lib/certificates/format";
import { PageHeader } from "@/components/page-header";
import { BulkForm } from "./bulk-form";

export const metadata: Metadata = { title: "إصدار جماعي" };

export default async function BulkPage() {
    await requireUser();
    return (
        <>
            <Link href="/certificates" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                الشهادات
            </Link>
            <PageHeader title="إصدار جماعي" description="لكل حضور محاضرة أو كورس دفعة واحدة: ارفع ملف الأسماء، راجعها، ثم أصدر." />
            <div className="max-w-4xl">
                <BulkForm today={todayIso()} />
            </div>
        </>
    );
}
