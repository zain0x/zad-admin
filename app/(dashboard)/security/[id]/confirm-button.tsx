"use client";

/** A small submit button that asks before running a destructive action. */
export function ConfirmButton({ message, children, className }: { message: string; children: React.ReactNode; className?: string }) {
    return (
        <button
            type="submit"
            className={className}
            onClick={(e) => {
                if (!window.confirm(message)) e.preventDefault();
            }}
        >
            {children}
        </button>
    );
}
