import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routeUser } from "@/lib/auth/route-auth";
import { can } from "@/lib/auth/permissions";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await routeUser();
    if (!auth || !can(auth.user, "lectures")) return new NextResponse("Unauthorized", { status: 401 });
    const l = await db.lecture.findUnique({ where: { id: (await params).id }, select: { imageKey: true } });
    if (!l?.imageKey) return new NextResponse("Not found", { status: 404 });
    const data = await readUpload(l.imageKey).catch(() => null);
    if (!data) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(data), {
        headers: { "Content-Type": TYPES[l.imageKey.split(".").pop()!] ?? "application/octet-stream", "Cache-Control": "private, max-age=60" },
    });
}
