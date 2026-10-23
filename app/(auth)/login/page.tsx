import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
    const auth = await getAuth();
    if (auth?.session.twoFactorPassed) redirect("/");

    return (
        <>
            <h1 className="text-lg font-semibold">تسجيل الدخول</h1>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">للموظفين المصرّح لهم فقط.</p>
            <LoginForm />
        </>
    );
}
