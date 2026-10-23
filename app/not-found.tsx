import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
    return (
        <main className="grid min-h-screen place-items-center p-6 text-center">
            <div>
                <p className="text-5xl font-bold text-primary">404</p>
                <p className="mt-3 text-muted-foreground">الصفحة غير موجودة.</p>
                <Link href="/" className={buttonClass("secondary", "md", "mt-6")}>
                    العودة للرئيسية
                </Link>
            </div>
        </main>
    );
}
