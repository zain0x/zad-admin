"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadFilesAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export function UploadForm({ requestId, accept }: { requestId: number; accept: string }) {
    const [state, action] = useActionState(uploadFilesAction, undefined);
    const ref = useRef<HTMLFormElement>(null);
    useEffect(() => {
        if (state?.ok) ref.current?.reset();
    }, [state]);
    return (
        <form ref={ref} action={action} className="space-y-2">
            <input type="hidden" name="requestId" value={requestId} />
            <input
                type="file"
                name="files"
                multiple
                required
                accept={accept}
                aria-label="ملفات"
                className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-primary"
            />
            <p className="text-xs text-muted-foreground">تقارير PDF، صور، Word، Excel، نصوص، أو ZIP. حتى 20 ميجا للملف، و10 ملفات بالمرة.</p>
            {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
            {state?.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
            <SubmitButton size="sm" variant="secondary" pendingText="جارٍ الرفع…">
                رفع
            </SubmitButton>
        </form>
    );
}
