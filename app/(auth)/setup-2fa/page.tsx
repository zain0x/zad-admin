import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePendingLogin } from "@/lib/auth/session";
import { generateTotpSecret, totpUri } from "@/lib/auth/totp";
import { open, seal } from "@/lib/auth/secret-box";
import { renderSvg } from "@/lib/qr/qr";
import { SetupForm } from "./setup-form";
import { finishTotpSetupAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "إعداد التحقق بخطوتين" };

export default async function SetupTwoFactorPage() {
    const { session, user } = await requirePendingLogin();
    if (user.totpEnabledAt && !session.totpSetupDone) redirect("/login/verify");
    if (user.totpEnabledAt) {
        // Refreshed after enabling: the backup codes were already shown once.
        return (
            <>
                <h1 className="text-lg font-semibold">تم تفعيل التحقق بخطوتين</h1>
                <p className="mt-1 mb-5 text-sm text-muted-foreground">تابع للدخول إلى اللوحة.</p>
                <form action={finishTotpSetupAction}>
                    <SubmitButton className="w-full">متابعة</SubmitButton>
                </form>
            </>
        );
    }

    // Keep one pending secret per user so a refresh shows the same QR code.
    if (!user.totpPendingSecret) {
        await db.user.updateMany({
            where: { id: user.id, totpPendingSecret: null },
            data: { totpPendingSecret: seal(generateTotpSecret()) },
        });
    }
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpPendingSecret: true } });
    const secret = open(fresh.totpPendingSecret!);
    const qr = renderSvg({ data: totpUri(secret, user.email), color: "#2b0f47", background: "#ffffff", dotStyle: "square", margin: 2 }, 400);
    const groupedSecret = secret.match(/.{1,4}/g)!.join(" ");

    return (
        <>
            <h1 className="text-lg font-semibold">فعّل التحقق بخطوتين</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                إلزامي لكل حساب. يحتاج تطبيق مصادقة على جوالك، مثل Google Authenticator أو Microsoft Authenticator.
            </p>
            <ol className="mt-4 list-decimal space-y-1 ps-5 text-sm">
                <li>افتح التطبيق واختر إضافة حساب ثم مسح رمز QR.</li>
                <li>امسح الرمز التالي.</li>
                <li>أدخل الرمز المكوّن من 6 أرقام الذي يظهر في التطبيق.</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`}
                alt="رمز QR لإضافة الحساب في تطبيق المصادقة"
                width={200}
                height={200}
                className="mx-auto my-4 rounded-lg border border-line"
            />
            <details className="mb-4 text-sm">
                <summary className="cursor-pointer text-primary">لا تستطيع المسح؟ أدخل المفتاح يدوياً</summary>
                <p className="ltr mt-2 rounded-lg bg-muted p-2 text-center font-mono text-sm break-all select-all">{groupedSecret}</p>
            </details>
            <SetupForm />
        </>
    );
}
