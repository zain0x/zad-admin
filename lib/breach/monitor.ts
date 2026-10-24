import type { MonitoredEmail, MonitorFrequency, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lookupBreaches, type Breach } from "@/lib/breach/sources";

/** How long until the next check. */
export function nextCheckFrom(frequency: MonitorFrequency, from = new Date()) {
    const days = frequency === "WEEKLY" ? 7 : 30;
    return new Date(from.getTime() + days * 24 * 3600_000);
}

const RETRY_AFTER_ERROR_MS = 6 * 3600_000;
/** HIBP keys allow a limited number of calls per minute; keep a gap between checks. */
const GAP_BETWEEN_CHECKS_MS = 2000;

const key = (name: string) => name.trim().toLowerCase();

export type CheckOutcome = { ok: true; breachCount: number; newBreaches: Breach[] } | { ok: false; error: string };

/**
 * Checks one email. The first check sets the baseline (nothing counts as "new");
 * after that, any breach name not seen before raises hasNewBreach until staff review it.
 */
export async function checkMonitoredEmail(m: MonitoredEmail): Promise<CheckOutcome> {
    const now = new Date();
    try {
        const report = await lookupBreaches(m.email);
        const known = new Set(((m.knownBreaches as string[] | null) ?? []).map(key));
        const firstCheck = !m.lastCheckedAt;
        const fresh = firstCheck ? [] : report.breaches.filter((b) => !known.has(key(b.name)));
        const allKnown = [...new Set([...known, ...report.breaches.map((b) => key(b.name))])];

        await db.$transaction([
            db.monitoredEmail.update({
                where: { id: m.id },
                data: {
                    knownBreaches: allKnown,
                    breachCount: report.breaches.length,
                    lastCheckedAt: now,
                    nextCheckAt: nextCheckFrom(m.frequency, now),
                    lastError: report.partial ? "مصدر واحد لم يستجب، النتيجة قد تكون ناقصة" : null,
                    ...(fresh.length ? { hasNewBreach: true, lastNewBreachAt: now } : {}),
                },
            }),
            db.emailCheck.create({
                data: {
                    emailId: m.id,
                    checkedAt: now,
                    breachCount: report.breaches.length,
                    newBreaches: (firstCheck ? report.breaches : fresh) as unknown as Prisma.InputJsonValue,
                    exposed: report.exposed,
                },
            }),
        ]);
        return { ok: true, breachCount: report.breaches.length, newBreaches: fresh };
    } catch (err) {
        const error = err instanceof Error ? err.message.slice(0, 250) : "فشل الفحص";
        await db.$transaction([
            db.monitoredEmail.update({
                where: { id: m.id },
                data: { lastError: "تعذّر الفحص، ستتم المحاولة مرة أخرى", nextCheckAt: new Date(now.getTime() + RETRY_AFTER_ERROR_MS) },
            }),
            db.emailCheck.create({ data: { emailId: m.id, checkedAt: now, error } }),
        ]);
        return { ok: false, error };
    }
}

let running = false;

/** Checks every active email whose time has come, oldest first, up to `limit` per run. */
export async function runDueChecks(limit = 25) {
    if (running) return { skipped: true as const, checked: 0, newAlerts: 0, failed: 0 };
    running = true;
    try {
        const due = await db.monitoredEmail.findMany({
            where: { status: "ACTIVE", nextCheckAt: { lte: new Date() } },
            orderBy: { nextCheckAt: "asc" },
            take: limit,
        });
        let newAlerts = 0;
        let failed = 0;
        for (const [i, m] of due.entries()) {
            if (i) await new Promise((r) => setTimeout(r, GAP_BETWEEN_CHECKS_MS));
            const r = await checkMonitoredEmail(m);
            if (!r.ok) failed++;
            else if (r.newBreaches.length) newAlerts++;
        }
        return { skipped: false as const, checked: due.length, newAlerts, failed };
    } finally {
        running = false;
    }
}
