import { cn } from "@/lib/utils";

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: React.ReactNode }) {
    return (
        <div
            role={tone === "error" ? "alert" : "status"}
            className={cn(
                "rounded-lg border px-3 py-2.5 text-sm",
                tone === "error" && "border-red-200 bg-red-50 text-red-800",
                tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                tone === "info" && "border-primary/20 bg-primary/5 text-foreground"
            )}
        >
            {children}
        </div>
    );
}
