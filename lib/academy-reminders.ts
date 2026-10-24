import { db } from "@/lib/db";
import { getSetting, lectureWhen, setSetting } from "@/lib/academy";
import { alertTelegram, esc, telegramConfigured } from "@/lib/telegram";

const KEY = "telegram.remindedLectures";

/**
 * Telegram reminder for lectures starting in the next 24 hours, once per lecture.
 * Runs from the hourly cron (/api/cron/email-monitor), so it needs no extra cron job.
 */
export async function runLectureReminders() {
    if (!telegramConfigured()) return 0;
    const now = new Date();
    const lectures = await db.lecture.findMany({
        where: { status: { in: ["PUBLISHED", "CLOSED"] }, startsAt: { gt: now, lte: new Date(now.getTime() + 24 * 3600_000) } },
        include: { _count: { select: { registrations: { where: { status: "CONFIRMED" } } } } },
    });
    if (!lectures.length) return 0;

    const done = new Set(await getSetting<string[]>(KEY, []));
    let sent = 0;
    for (const l of lectures) {
        if (done.has(l.id)) continue;
        const when = lectureWhen(l.startsAt);
        await alertTelegram(
            "lecture_reminder",
            [
                `<b>${esc(l.titleAr)}</b>`,
                `الموعد: ${esc(when.date)} · ${esc(when.time)}`,
                l.mode === "ONLINE" ? "أونلاين" : `المكان: ${esc(l.location || "—")}`,
                `المسجلين: <b>${l._count.registrations}</b> من ${l.capacity}`,
            ],
            `/academy/${l.id}`
        );
        done.add(l.id);
        sent++;
    }
    // Keep only ids of lectures that haven't finished yet, so the list stays small.
    const upcoming = await db.lecture.findMany({ where: { id: { in: [...done] }, startsAt: { gt: new Date(now.getTime() - 864e5) } }, select: { id: true } });
    await setSetting(KEY, upcoming.map((u) => u.id));
    return sent;
}
