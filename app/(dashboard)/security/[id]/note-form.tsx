"use client";

import { useRef } from "react";
import { addNoteAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export function NoteForm({ requestId }: { requestId: number }) {
    const ref = useRef<HTMLFormElement>(null);
    return (
        <form
            ref={ref}
            action={async (fd) => {
                await addNoteAction(fd);
                ref.current?.reset();
            }}
            className="space-y-2"
        >
            <input type="hidden" name="requestId" value={requestId} />
            <textarea
                name="body"
                required
                maxLength={5000}
                rows={3}
                placeholder="ملاحظة داخلية: ماذا تم، ماذا قال العميل، الخطوة القادمة…"
                aria-label="ملاحظة جديدة"
                className="w-full rounded-lg border border-line bg-white p-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
            <SubmitButton size="sm" pendingText="جارٍ الحفظ…">
                إضافة ملاحظة
            </SubmitButton>
        </form>
    );
}
