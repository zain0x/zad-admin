"use client";

import { useActionState } from "react";
import { manageUserAction } from "./actions";
import { SECTIONS } from "@/lib/auth/sections";
import { SubmitButton } from "@/components/submit-button";

type Perms = { permCertificates: boolean; permSites: boolean; permEmails: boolean };

export function PermsForm({ userId, perms }: { userId: string; perms: Perms }) {
    const [state, action] = useActionState(manageUserAction, undefined);
    return (
        <form action={action} className="space-y-1.5">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="intent" value="perms" />
            {SECTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-xs whitespace-nowrap">
                    <input type="checkbox" name={s.field} defaultChecked={perms[s.field]} />
                    {s.label}
                </label>
            ))}
            <SubmitButton size="sm" variant="ghost" className="h-7 px-2 text-xs text-primary" pendingText="…">
                حفظ
            </SubmitButton>
            {state?.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
            {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
        </form>
    );
}
