import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { routeUser } from "@/lib/auth/route-auth";
import { can } from "@/lib/auth/permissions";
import { htmlToPdf } from "@/lib/certificates/pdf";
import { canSeeRequest } from "@/lib/requests";
import { renderScanReportHtml } from "@/lib/reports/scan-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The branded security report (PDF) built from the request's findings. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await routeUser();
    if (!auth || !can(auth.user, "sites")) return new NextResponse("Unauthorized", { status: 401 });
    const id = Number((await params).id);
    const r = await db.scanRequest.findUnique({ where: { id }, include: { assignee: { select: { name: true } }, findings: true } });
    if (!r || !canSeeRequest(auth.user, r)) return new NextResponse("Not found", { status: 404 });

    const html = renderScanReportHtml(r);
    if (new URL(req.url).searchParams.get("view") === "html") {
        return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }
    try {
        const pdf = await htmlToPdf(html);
        await audit({ actorId: auth.user.id, action: "request.report_downloaded", targetType: "scan_request", targetId: String(r.id) });
        const host = (r.target ?? "site").replace(/^https?:\/\//, "").replace(/[^A-Za-z0-9.-]+/g, "-").slice(0, 60);
        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="Zad-Security-Report-${r.id}-${host}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("Report PDF failed", err);
        return new NextResponse("تعذّر إنشاء التقرير. على الجهاز: npm run pdf:install", { status: 500 });
    }
}
