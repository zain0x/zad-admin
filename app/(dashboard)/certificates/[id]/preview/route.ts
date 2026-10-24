import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeUser } from "@/lib/auth/route-auth";
import { can } from "@/lib/auth/permissions";
import { renderCertificatesHtml } from "@/lib/certificates/template";

export const dynamic = "force-dynamic";

/** The certificate as HTML, shown in an iframe on the details page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await routeUser();
    if (!auth || !can(auth.user, "certificates")) return new NextResponse("Unauthorized", { status: 401 });
    const { id } = await params;
    const cert = await db.certificate.findUnique({ where: { id } });
    if (!cert) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(renderCertificatesHtml([cert], { preview: true }), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
}
