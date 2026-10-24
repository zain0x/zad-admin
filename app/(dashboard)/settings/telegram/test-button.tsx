"use client";

import { useActionState } from "react";
import { testTelegramAction } from "./actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";

export function TestButton() {
    const [state, action] = useActionState(testTelegramAction, undefined);
    return (
        <form action={action} className="space-y-3">
            {state?.ok && <Alert tone="success">{state.ok}</Alert>}
            {state?.error && <Alert>{state.error}</Alert>}
            <SubmitButton variant="secondary" size="sm" pendingText="جارٍ الإرسال…">
                ابعث رسالة تجربة
            </SubmitButton>
        </form>
    );
}
