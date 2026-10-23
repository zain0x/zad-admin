import { cn } from "@/lib/utils";

const tones = {
    neutral: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-800",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
    return (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
            {children}
        </span>
    );
}
