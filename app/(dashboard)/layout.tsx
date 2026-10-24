import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { sectionsOf } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user } = await requireUser();
    const sections = sectionsOf(user);
    const isAdmin = user.role === "ADMIN";
    const [newRequests, newBreaches] = await Promise.all([
        // Admins: new requests waiting. Staff: open files assigned to them.
        !sections.sites
            ? 0
            : isAdmin
              ? db.scanRequest.count({ where: { status: "NEW", type: { in: ["SITE", "LEAK"] } } })
              : db.scanRequest.count({ where: { assigneeId: user.id, closedAt: null, type: { in: ["SITE", "LEAK"] } } }),
        sections.emails ? db.monitoredEmail.count({ where: { hasNewBreach: true } }) : 0,
    ]);
    return (
        <div className="min-h-screen md:flex">
            <Sidebar name={user.name} role={user.role} sections={sections} newRequests={newRequests} newBreaches={newBreaches} />
            <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
                <div className="mx-auto max-w-6xl">{children}</div>
            </main>
        </div>
    );
}
