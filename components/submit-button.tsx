"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
    children,
    pendingText = "جارٍ التنفيذ…",
    ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
            {pending ? pendingText : children}
        </Button>
    );
}
