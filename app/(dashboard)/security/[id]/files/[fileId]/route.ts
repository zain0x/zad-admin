import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeUser } from "@/lib/auth/route-auth";
import { can } from "@/lib/auth/permissions";
import { canSeeRequest } from "@/lib/requests";
import { readUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Download an attachment. Always as a download, never rendered inline (no stored XSS). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
    const auth = await routeUser();
    if (!auth || !can(auth.user, "sites")) return new NextResponse("Unauthorized", { status: 401 });
    const p = await params;
    const file = await db.requestFile.findFirst({ where: { id: p.fileId, requestId: Number(p.id) }, include: { request: { select: { assigneeId: true } } } });
    if (!file || !canSeeRequest(auth.user, file.request)) return new NextResponse("Not found", { status: 404 });
    try {
        const data = await readUpload(file.storageKey);
        return new NextResponse(new Uint8Array(data), {
            headers: {
                "Content-Type": file.mime.startsWith("image/") || file.mime === "application/pdf" ? file.mime : "application/octet-stream",
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-store",
            },
        });
    } catch {
        return new NextResponse("الملف غير موجود على الخادم.", { status: 404 });
    }
}
