import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "border border-line bg-white text-foreground hover:bg-muted",
    ghost: "text-foreground hover:bg-muted",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

const sizes: Record<Size, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
    return cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
    );
}

export function Button({
    variant,
    size,
    className,
    ...props
}: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
    return <button className={buttonClass(variant, size, className)} {...props} />;
}
