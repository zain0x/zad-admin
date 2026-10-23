import { requireUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user } = await requireUser();
    return (
        <div className="min-h-screen md:flex">
            <Sidebar name={user.name} role={user.role} />
            <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
                <div className="mx-auto max-w-6xl">{children}</div>
            </main>
        </div>
    );
}
