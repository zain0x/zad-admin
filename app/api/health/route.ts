import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** For uptime checks: 200 when the app and the database answer. */
export async function GET() {
    try {
        await db.$queryRaw`SELECT 1`;
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 503 });
    }
}
