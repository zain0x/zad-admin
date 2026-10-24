"use client";

import { Button } from "@/components/ui/button";

export function ConfirmRemove({ id, action }: { id: string; action: (fd: FormData) => Promise<void> }) {
    return (
        <form
            action={action}
            onSubmit={(e) => {
                if (!window.confirm("حذف هذا الإيميل من المراقبة؟ سيُحذف سجل فحوصاته أيضاً.")) e.preventDefault();
            }}
        >
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="danger" className="w-full">
                حذف من المراقبة
            </Button>
        </form>
    );
}
