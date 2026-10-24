import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkServerCall } from "@/lib/server-to-server";
import { INTERNSHIPS_OPEN, INTERNSHIP_FIELDS, durationLabel, getSetting, lectureState, lectureWhen } from "@/lib/academy";

export const dynamic = "force-dynamic";

/**
 * What zad.gg/academy shows. Signed GET over "GET /api/public/academy".
 * Never returns the online meeting link: that is only given to people after they register.
 */
export async function GET(req: NextRequest) {
    const check = checkServerCall(req, "GET /api/public/academy");
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: check.reason === "disabled" ? 503 : 401 });

    const now = new Date();
    const [lectures, counts, open] = await Promise.all([
        db.lecture.findMany({
            where: { status: { in: ["PUBLISHED", "CLOSED"] }, startsAt: { gte: new Date(now.getTime() - 30 * 864e5) } },
            orderBy: { startsAt: "asc" },
            take: 60,
        }),
        db.lectureRegistration.groupBy({ by: ["lectureId"], where: { status: "CONFIRMED" }, _count: true }),
        getSetting<boolean>(INTERNSHIPS_OPEN, true),
    ]);
    const confirmed = new Map(counts.map((c) => [c.lectureId, c._count]));

    const items = lectures.map((l) => {
        const n = confirmed.get(l.id) ?? 0;
        const when = lectureWhen(l.startsAt);
        return {
            id: l.id,
            titleAr: l.titleAr,
            titleEn: l.titleEn,
            speaker: l.speaker,
            description: l.description,
            startsAt: l.startsAt.toISOString(),
            date: when.date,
            time: when.time,
            duration: durationLabel(l.durationMinutes),
            durationMinutes: l.durationMinutes,
            mode: l.mode,
            location: l.mode === "IN_PERSON" ? l.location : null,
            capacity: l.capacity,
            seatsLeft: Math.max(0, l.capacity - n),
            state: lectureState(l, n, now),
            registrationDeadline: l.registrationDeadline?.toISOString() ?? null,
            image: l.imageKey ? `${l.id}?v=${l.updatedAt.getTime()}` : null,
        };
    });

    return NextResponse.json({
        upcoming: items.filter((i) => i.state !== "past"),
        past: items.filter((i) => i.state === "past").reverse().slice(0, 6),
        internships: { open, fields: INTERNSHIP_FIELDS },
    });
}
