"use client";

import { useActionState } from "react";
import { changePasswordAction } from "../actions";
import { Alert } from "@/components/ui/alert";
import { Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function ChangePasswordForm() {
    const [state, action] = useActionState(changePasswordAction, undefined);
    return (
        <form action={action} className="space-y-4">
            {state?.error && <Alert>{state.error}</Alert>}
            <div>
                <Label htmlFor="current">كلمة المرور الحالية</Label>
                <Input id="current" name="current" type="password" autoComplete="current-password" dir="ltr" required />
            </div>
            <div>
                <Label htmlFor="next">كلمة المرور الجديدة</Label>
                <Input id="next" name="next" type="password" autoComplete="new-password" dir="ltr" minLength={12} required />
            </div>
            <div>
                <Label htmlFor="confirm">تأكيد كلمة المرور الجديدة</Label>
                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" dir="ltr" minLength={12} required />
            </div>
            <SubmitButton className="w-full" pendingText="جارٍ الحفظ…">
                حفظ
            </SubmitButton>
        </form>
    );
}
