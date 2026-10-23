"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { Alert } from "@/components/ui/alert";
import { Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm() {
    const [state, action] = useActionState(loginAction, undefined);
    return (
        <form action={action} className="space-y-4">
            {state?.error && <Alert>{state.error}</Alert>}
            <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" name="email" type="email" autoComplete="username" dir="ltr" required autoFocus />
            </div>
            <div>
                <Label htmlFor="password">كلمة المرور</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required />
            </div>
            <SubmitButton className="w-full" pendingText="جارٍ التحقق…">
                دخول
            </SubmitButton>
        </form>
    );
}
