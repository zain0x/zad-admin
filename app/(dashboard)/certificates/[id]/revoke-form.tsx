"use client";

import { useState } from "react";
import { revokeCertificateAction } from "../actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

export function RevokeForm({ id }: { id: string }) {
    const [open, setOpen] = useState(false);
    if (!open) {
        return (
            <Button variant="danger" className="w-full" onClick={() => setOpen(true)}>
                إلغاء الشهادة
            </Button>
        );
    }
    return (
        <form action={revokeCertificateAction} className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm text-red-800">صفحة التحقق ستعرض أن الشهادة ملغاة. يمكن إعادة تفعيلها لاحقاً.</p>
            <textarea
                name="reason"
                maxLength={500}
                rows={2}
                placeholder="سبب الإلغاء (داخلي)"
                aria-label="سبب الإلغاء"
                className="w-full rounded-lg border border-red-200 bg-white p-2 text-sm"
            />
            <div className="flex gap-2">
                <SubmitButton variant="danger" size="sm" pendingText="جارٍ الإلغاء…">
                    تأكيد الإلغاء
                </SubmitButton>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    تراجع
                </Button>
            </div>
        </form>
    );
}
