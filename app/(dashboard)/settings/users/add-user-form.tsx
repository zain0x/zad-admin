"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserAction } from "./actions";
import { TempPassword } from "./temp-password";
import { Alert } from "@/components/ui/alert";
import { Input, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { SECTIONS } from "@/lib/auth/sections";

export function AddUserForm() {
    const [state, action] = useActionState(createUserAction, undefined);
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        if (state?.ok) formRef.current?.reset();
    }, [state]);

    return (
        <div className="p-5">
            <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
                <div>
                    <Label htmlFor="name">الاسم</Label>
                    <Input id="name" name="name" required maxLength={120} />
                </div>
                <div>
                    <Label htmlFor="new-email">البريد الإلكتروني</Label>
                    <Input id="new-email" name="email" type="email" dir="ltr" required />
                </div>
                <div>
                    <Label htmlFor="role">الدور</Label>
                    <Select id="role" name="role" defaultValue="STAFF">
                        <option value="STAFF">موظف</option>
                        <option value="ADMIN">مدير</option>
                    </Select>
                </div>
                <SubmitButton pendingText="جارٍ الإضافة…">إضافة</SubmitButton>
                <fieldset className="sm:col-span-4">
                    <legend className="mb-1.5 text-sm font-medium">الأقسام المسموحة (للموظف، المدير عنده الكل)</legend>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {SECTIONS.map((s) => (
                            <label key={s.key} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" name={s.field} />
                                {s.label}
                                <span className="text-xs text-muted-foreground">({s.hint})</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
            </form>
            {state?.error && (
                <div className="mt-3">
                    <Alert>{state.error}</Alert>
                </div>
            )}
            {state?.ok && (
                <div className="mt-3">
                    <Alert tone="success">{state.ok}</Alert>
                </div>
            )}
            {state?.tempPassword && <TempPassword email={state.email} password={state.tempPassword} />}
        </div>
    );
}
