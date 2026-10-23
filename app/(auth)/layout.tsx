import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="grid min-h-screen place-items-center bg-muted px-4 py-10">
            <div className="w-full max-w-sm">
                <div className="mb-6 flex flex-col items-center gap-2">
                    <Image src="/brand/zad-logo-primary.svg" alt="زاد" width={96} height={44} priority />
                    <span className="text-sm text-muted-foreground">لوحة التحكم</span>
                </div>
                <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">{children}</div>
            </div>
        </main>
    );
}
