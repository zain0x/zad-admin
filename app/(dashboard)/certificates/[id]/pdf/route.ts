import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeUser } from "@/lib/auth/route-auth";
import { can } from "@/lib/auth/permissions";
import { certificatesPdf } from "@/lib/certificates/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fileName(nameEn: string, code: string) {
    return `${code}-${nameEn.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await routeUser();
    if (!auth || !can(auth.user, "certificates")) return new NextResponse("Unauthorized", { status: 401 });
    const { id } = await params;
    const cert = await db.certificate.findUnique({ where: { id } });
    if (!cert) return new NextResponse("Not found", { status: 404 });
    if (cert.status === "REVOKED") return new NextResponse("هذه الشهادة ملغاة.", { status: 410 });
    try {
        const pdf = await certificatesPdf([cert]);
        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${fileName(cert.nameEn, cert.code)}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("PDF generation failed", err);
        return new NextResponse("تعذّر إنشاء ملف PDF. على الجهاز: npm run pdf:install", { status: 500 });
    }
}
