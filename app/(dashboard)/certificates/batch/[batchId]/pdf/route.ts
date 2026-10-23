import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeUser } from "@/lib/auth/route-auth";
import { certificatesPdf } from "@/lib/certificates/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Every active certificate of one bulk issue, one per page, in a single PDF to print. */
export async function GET(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
    if (!(await routeUser())) return new NextResponse("Unauthorized", { status: 401 });
    const { batchId } = await params;
    const certs = await db.certificate.findMany({ where: { batchId, status: "ACTIVE" }, orderBy: { nameEn: "asc" }, take: 500 });
    if (!certs.length) return new NextResponse("Not found", { status: 404 });
    try {
        const pdf = await certificatesPdf(certs);
        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="zad-certificates-${batchId}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("Batch PDF generation failed", err);
        return new NextResponse("تعذّر إنشاء ملف PDF. على الجهاز: npm run pdf:install", { status: 500 });
    }
}
