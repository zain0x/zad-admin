import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkServerCall } from "@/lib/server-to-server";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** Cover image of a published lecture. Signed GET over "GET /api/public/academy/lectures/<id>/image". */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id;
    if (!/^[a-z0-9]{10,40}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
    const check = checkServerCall(req, `GET /api/public/academy/lectures/${id}/image`);
    if (!check.ok) return new NextResponse(check.reason, { status: check.reason === "disabled" ? 503 : 401 });

    const l = await db.lecture.findUnique({ where: { id }, select: { imageKey: true, status: true } });
    if (!l?.imageKey || l.status === "DRAFT") return new NextResponse("Not found", { status: 404 });
    const data = await readUpload(l.imageKey).catch(() => null);
    if (!data) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(data), {
        headers: { "Content-Type": TYPES[l.imageKey.split(".").pop()!] ?? "application/octet-stream", "Cache-Control": "private, max-age=300" },
    });
}
