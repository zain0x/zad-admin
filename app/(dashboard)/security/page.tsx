import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Zad Security" };

export default async function Page() {
    await requireUser();
    return (
        <>
            <PageHeader title="Zad Security" />
            <Card className="p-10 text-center">
                <p className="font-semibold">قريباً</p>
                <p className="mt-2 text-sm text-muted-foreground">طلبات فحص المواقع، المشتركون في التنبيهات، وفرص البيع. تُبنى في المرحلة 2.</p>
            </Card>
        </>
    );
}
