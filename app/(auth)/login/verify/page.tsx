import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePendingLogin } from "@/lib/auth/session";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "التحقق بخطوتين" };

export default async function VerifyPage() {
    const { user } = await requirePendingLogin();
    if (!user.totpEnabledAt) redirect("/setup-2fa");

    return (
        <>
            <h1 className="text-lg font-semibold">التحقق بخطوتين</h1>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">
                أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة على جوالك.
            </p>
            <VerifyForm />
        </>
    );
}
