import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "الشهادات" };

export default async function Page() {
    await requireUser();
    return (
        <>
            <PageHeader title="الشهادات" />
            <Card className="p-10 text-center">
                <p className="font-semibold">قريباً</p>
                <p className="mt-2 text-sm text-muted-foreground">شهادات التدريب والمحاضرات والكورسات، مع التحقق على zad.gg/cert. تُبنى في المرحلة 3.</p>
            </Card>
        </>
    );
}
