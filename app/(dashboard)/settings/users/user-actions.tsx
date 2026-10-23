"use client";

import { useActionState } from "react";
import { manageUserAction } from "./actions";
import { TempPassword } from "./temp-password";
import { Button } from "@/components/ui/button";

type Props = { userId: string; name: string; role: "ADMIN" | "STAFF"; isActive: boolean; has2fa: boolean };

export function UserActions({ userId, name, role, isActive, has2fa }: Props) {
    const [state, action, pending] = useActionState(manageUserAction, undefined);

    const confirmThen = (message: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!window.confirm(message)) e.preventDefault();
    };

    return (
        <div>
            <form action={action} className="flex flex-wrap gap-1.5">
                <input type="hidden" name="userId" value={userId} />
                <Button size="sm" variant="secondary" name="intent" value="role" disabled={pending}
                    onClick={confirmThen(role === "ADMIN" ? `تحويل ${name} إلى موظف؟` : `منح ${name} صلاحيات المدير؟`)}>
                    {role === "ADMIN" ? "اجعله موظفاً" : "اجعله مديراً"}
                </Button>
                <Button size="sm" variant="secondary" name="intent" value="resetPassword" disabled={pending}
                    onClick={confirmThen(`إعادة تعيين كلمة مرور ${name}؟ سيتم تسجيل خروجه.`)}>
                    كلمة مرور مؤقتة
                </Button>
                {has2fa && (
                    <Button size="sm" variant="secondary" name="intent" value="reset2fa" disabled={pending}
                        onClick={confirmThen(`إعادة ضبط التحقق بخطوتين لـ ${name}؟ استخدمها فقط إذا فقد جواله.`)}>
                        إعادة ضبط 2FA
                    </Button>
                )}
                <Button size="sm" variant={isActive ? "danger" : "secondary"} name="intent" value="toggle" disabled={pending}
                    onClick={confirmThen(isActive ? `تعطيل حساب ${name}؟` : `تفعيل حساب ${name}؟`)}>
                    {isActive ? "تعطيل" : "تفعيل"}
                </Button>
            </form>
            {state?.error && <p className="mt-2 text-xs text-red-700">{state.error}</p>}
            {state?.ok && !state.tempPassword && <p className="mt-2 text-xs text-emerald-700">{state.ok}</p>}
            {state?.tempPassword && <TempPassword email={state.email} password={state.tempPassword} />}
        </div>
    );
}
