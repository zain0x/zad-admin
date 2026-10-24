import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { runDueChecks } from "@/lib/breach/monitor";
import { runLectureReminders } from "@/lib/academy-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Runs the scheduled email checks. Call it hourly from CloudPanel → Cron Jobs:
 *   curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3001/api/cron/email-monitor
 */
export async function POST(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 503 });
    const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
    const expected = Buffer.from(secret);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const reminders = await runLectureReminders().catch((err) => {
        console.error("lecture reminders failed", err);
        return 0;
    });
    const result = await runDueChecks();
    if (result.checked) await audit({ actorId: null, action: "email.monitor_run", details: { ...result, via: "cron" } });
    return NextResponse.json({ ...result, lectureReminders: reminders });
}
