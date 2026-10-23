"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function CopyButton({ text, label }: { text: string; label: string }) {
    const [done, setDone] = useState(false);
    return (
        <button
            type="button"
            className={buttonClass("secondary", "md", "w-full")}
            onClick={() =>
                navigator.clipboard?.writeText(text).then(() => {
                    setDone(true);
                    setTimeout(() => setDone(false), 1500);
                })
            }
        >
            {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {done ? "تم النسخ" : label}
        </button>
    );
}
