"use client";

import { useActionState, useEffect, useRef } from "react";
import { addEmailsAction, runDueAction } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function AddEmailsForm() {
    const [state, action] = useActionState(addEmailsAction, undefined);
    const ref = useRef<HTMLFormElement>(null);
    useEffect(() => {
        if (state?.ok) ref.current?.reset();
    }, [state]);
    return (
        <form ref={ref} action={action} className="space-y-3 p-5">
            {state?.error && <Alert>{state.error}</Alert>}
            {state?.ok && <Alert tone="success">{state.ok}</Alert>}
            <div>
                <Label htmlFor="emails">الإيميلات</Label>
                <textarea
                    id="emails"
                    name="emails"
                    required
                    rows={3}
                    dir="ltr"
                    placeholder={"info@store.com\nowner@store.com"}
                    className="w-full rounded-lg border border-line bg-white p-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <p className="mt-1 text-xs text-muted-foreground">إيميل واحد أو أكثر، كل واحد بسطر أو بينها فاصلة.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <div>
                    <Label htmlFor="frequency">تكرار الفحص</Label>
                    <Select id="frequency" name="frequency" defaultValue="WEEKLY">
                        <option value="WEEKLY">أسبوعي</option>
                        <option value="MONTHLY">شهري</option>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="note">ملاحظة (اختياري)</Label>
                    <input
                        id="note"
                        name="note"
                        maxLength={500}
                        placeholder="مثلاً: عميل زاد برو، متجر الأناقة"
                        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                </div>
            </div>
            <SubmitButton pendingText="جارٍ الإضافة…">إضافة للمراقبة</SubmitButton>
        </form>
    );
}

export function RunDueButton({ due }: { due: number }) {
    const [state, action] = useActionState(runDueAction, undefined);
    return (
        <form action={action} className="flex flex-col items-end gap-2">
            <SubmitButton variant="secondary" pendingText="جارٍ الفحص… (قد يأخذ دقيقة)">
                افحص المستحق الآن ({due})
            </SubmitButton>
            {state?.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
            {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
        </form>
    );
}
