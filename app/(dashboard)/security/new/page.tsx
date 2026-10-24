import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { todayIso } from "@/lib/certificates/format";
import { PageHeader } from "@/components/page-header";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = { title: "طلب فحص جديد" };

export default async function NewRequestPage() {
    const { user } = await requireSection("sites");
    if (user.role !== "ADMIN") redirect("/security");
    const staff = await db.user.findMany({
        where: { isActive: true, OR: [{ role: "ADMIN" }, { permSites: true }] },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
    });
    return (
        <>
            <Link href="/security" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                فحص المواقع
            </Link>
            <PageHeader title="طلب فحص جديد" description="لعميل تواصل معكم مباشرة. الطلبات من zad.gg/security تُنشأ تلقائياً." />
            <div className="max-w-3xl">
                <NewRequestForm staff={staff} today={todayIso()} />
            </div>
        </>
    );
}
