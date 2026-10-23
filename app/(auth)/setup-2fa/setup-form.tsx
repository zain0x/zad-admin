"use client";

import { useActionState, useState } from "react";
import { confirmTotpSetupAction, finishTotpSetupAction } from "../actions";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function SetupForm() {
    const [state, action] = useActionState(confirmTotpSetupAction, undefined);
    const [saved, setSaved] = useState(false);

    if (state?.backupCodes) {
        const text = state.backupCodes.join("\n");
        return (
            <div className="space-y-4">
                <Alert tone="success">تم تفعيل التحقق بخطوتين.</Alert>
                <div>
                    <p className="text-sm font-medium">رموزك الاحتياطية</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        إذا فقدت جوالك تدخل بأحدها، وكل رمز يُستخدم مرة واحدة. احفظها في مكان آمن، فلن تظهر مرة ثانية.
                    </p>
                </div>
                <ul className="ltr grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 text-center font-mono text-sm">
                    {state.backupCodes.map((c) => (
                        <li key={c}>{c}</li>
                    ))}
                </ul>
                <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(text)}
                    className={buttonClass("secondary", "md", "w-full")}
                >
                    نسخ الرموز
                </button>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
                    حفظت الرموز في مكان آمن
                </label>
                <form action={finishTotpSetupAction}>
                    <SubmitButton className="w-full" disabled={!saved} pendingText="جارٍ الدخول…">
                        متابعة
                    </SubmitButton>
                </form>
            </div>
        );
    }

    return (
        <form action={action} className="space-y-4">
            {state?.error && <Alert>{state.error}</Alert>}
            <div>
                <Label htmlFor="code">الرمز من التطبيق</Label>
                <Input
                    id="code"
                    name="code"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={7}
                    required
                    className="text-center text-lg tracking-[0.3em]"
                />
            </div>
            <SubmitButton className="w-full" pendingText="جارٍ التحقق…">
                تفعيل
            </SubmitButton>
        </form>
    );
}
