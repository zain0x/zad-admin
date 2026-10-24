import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeUser } from "@/lib/auth/route-auth";
import { can } from "@/lib/auth/permissions";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await routeUser();
    if (!auth || !can(auth.user, "internships")) return new NextResponse("Unauthorized", { status: 401 });
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) return new NextResponse("Not found", { status: 404 });
    const a = await db.internshipApplication.findUnique({ where: { id }, select: { cvKey: true, cvName: true } });
    if (!a?.cvKey) return new NextResponse("Not found", { status: 404 });
    const data = await readUpload(a.cvKey).catch(() => null);
    if (!data) return new NextResponse("Not found", { status: 404 });
    const name = a.cvName || `cv-${id}.pdf`;
    return new NextResponse(new Uint8Array(data), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="cv-${id}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    });
}
