"use client";

import { useActionState, useState } from "react";
import { logoutAction, verifyTwoFactorAction } from "../../actions";
import { Alert } from "@/components/ui/alert";
import { Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function VerifyForm() {
    const [state, action] = useActionState(verifyTwoFactorAction, undefined);
    const [backup, setBackup] = useState(false);

    return (
        <div className="space-y-4">
            <form action={action} className="space-y-4">
                {state?.error && <Alert>{state.error}</Alert>}
                <div>
                    <Label htmlFor="code">{backup ? "رمز احتياطي" : "رمز التحقق"}</Label>
                    <Input
                        key={backup ? "backup" : "totp"}
                        id="code"
                        name="code"
                        dir="ltr"
                        required
                        autoFocus
                        autoComplete="one-time-code"
                        inputMode={backup ? "text" : "numeric"}
                        placeholder={backup ? "xxxx-xxxx" : "123456"}
                        maxLength={backup ? 9 : 7}
                        className="text-center text-lg tracking-[0.3em]"
                    />
                </div>
                <SubmitButton className="w-full" pendingText="جارٍ التحقق…">
                    تحقق
                </SubmitButton>
            </form>
            <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setBackup((b) => !b)} className="text-primary hover:underline">
                    {backup ? "استخدم تطبيق المصادقة" : "فقدت جوالك؟ استخدم رمزاً احتياطياً"}
                </button>
                <form action={logoutAction}>
                    <button type="submit" className="text-muted-foreground hover:underline">
                        إلغاء
                    </button>
                </form>
            </div>
        </div>
    );
}
