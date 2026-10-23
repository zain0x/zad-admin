import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "تغيير كلمة المرور" };

export default async function ChangePasswordPage() {
    const { user } = await requireUser({ allowPasswordChange: true });

    return (
        <>
            <h1 className="text-lg font-semibold">تغيير كلمة المرور</h1>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">
                {user.mustChangePassword
                    ? "كلمة مرورك مؤقتة. اختر كلمة مرور خاصة بك قبل المتابعة."
                    : "سيتم تسجيل خروجك من الأجهزة الأخرى."}{" "}
                {PASSWORD_MIN_LENGTH} حرفاً على الأقل، والأفضل جملة طويلة تتذكرها.
            </p>
            <ChangePasswordForm />
            {!user.mustChangePassword && (
                <Link href="/" className="mt-4 block text-center text-sm text-muted-foreground hover:underline">
                    رجوع
                </Link>
            )}
        </>
    );
}
