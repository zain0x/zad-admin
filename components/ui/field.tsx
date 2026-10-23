import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
    return <label className={cn("mb-1.5 block text-sm font-medium", className)} {...props} />;
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            className={cn(
                "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm",
                "placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none",
                "disabled:opacity-60",
                className
            )}
            {...props}
        />
    );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
    return (
        <select
            className={cn(
                "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm",
                "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none",
                className
            )}
            {...props}
        />
    );
}
