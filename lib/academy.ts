import { randomBytes } from "node:crypto";
import type { InternshipStatus, Lecture, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ─── Lectures ─────────────────────────────────────────────────────────

const TZ = "Asia/Amman";

/** "2026-11-12T18:00" typed in Amman → Date. */
export function fromAmmanLocal(v: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
    const d = new Date(`${v}:00+03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "2026-11-12T18:00" in Amman, for datetime-local inputs. */
export function toAmmanLocal(d: Date | null | undefined): string {
    if (!d) return "";
    const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
            .formatToParts(d)
            .map((x) => [x.type, x.value])
    );
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const longDate = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const time = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** "الخميس، 12 نوفمبر 2026" and "6:00 م" */
export function lectureWhen(d: Date) {
    return { date: longDate.format(d), time: time.format(d) };
}

export function durationLabel(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const hours = h === 0 ? "" : h === 1 ? "ساعة" : h === 2 ? "ساعتان" : h <= 10 ? `${h} ساعات` : `${h} ساعة`;
    const mins = m ? `${m} دقيقة` : "";
    return [hours, mins].filter(Boolean).join(" و") || "—";
}

export type LectureState = "open" | "full" | "deadline" | "closed" | "past" | "draft";

export const LECTURE_STATE_LABELS: Record<LectureState, string> = {
    open: "التسجيل مفتوح",
    full: "اكتمل العدد",
    deadline: "انتهى التسجيل",
    closed: "مكتملة",
    past: "انتهت",
    draft: "مسودة",
};

/** Whether people can register right now, and why not. */
export function lectureState(l: Pick<Lecture, "status" | "startsAt" | "capacity" | "registrationDeadline">, confirmed: number, now = new Date()): LectureState {
    if (l.status === "DRAFT") return "draft";
    if (l.startsAt <= now) return "past";
    if (l.status === "CLOSED") return "closed";
    if (l.registrationDeadline && l.registrationDeadline <= now) return "deadline";
    if (confirmed >= l.capacity) return "full";
    return "open";
}

/** R-7K3F9Q, unique. */
export async function newRegistrationCode() {
    const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 8; i++) {
        const b = randomBytes(6);
        let s = "R-";
        for (let j = 0; j < 6; j++) s += A[b[j] % A.length];
        if (!(await db.lectureRegistration.findUnique({ where: { code: s }, select: { id: true } }))) return s;
    }
    throw new Error("Could not generate a registration code");
}

// ─── Internships ──────────────────────────────────────────────────────

export const INTERNSHIP_FIELDS = [
    "الأمن السيبراني",
    "البرمجة",
    "التجارة الإلكترونية",
    "التسويق",
    "المبيعات",
    "الذكاء الاصطناعي",
];

export const INTERNSHIP_STATUS: Record<InternshipStatus, { label: string; tone: "primary" | "warning" | "success" | "neutral" | "danger" }> = {
    NEW: { label: "جديد", tone: "primary" },
    REVIEWING: { label: "قيد المراجعة", tone: "warning" },
    ACCEPTED: { label: "مقبول", tone: "success" },
    ACTIVE: { label: "يتدرّب حالياً", tone: "success" },
    COMPLETED: { label: "أنهى التدريب", tone: "neutral" },
    REJECTED: { label: "مرفوض", tone: "danger" },
};

export const INTERNSHIP_ORDER: InternshipStatus[] = ["NEW", "REVIEWING", "ACCEPTED", "ACTIVE", "COMPLETED", "REJECTED"];

export function isInternshipStatus(v: unknown): v is InternshipStatus {
    return typeof v === "string" && (INTERNSHIP_ORDER as string[]).includes(v);
}

// ─── Settings ─────────────────────────────────────────────────────────

export async function getSetting<T extends Prisma.JsonValue>(key: string, fallback: T): Promise<T> {
    const s = await db.setting.findUnique({ where: { key } });
    return (s?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: Prisma.InputJsonValue) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export const INTERNSHIPS_OPEN = "academy.internshipsOpen";

/** Public academy page on the landing site (same origin as the certificate verify page). */
export function academyPublicUrl(lectureId?: string) {
    const base = process.env.CERT_VERIFY_BASE_URL || "https://zad.gg/cert";
    let origin = "https://zad.gg";
    try {
        origin = new URL(base).origin;
    } catch {}
    return lectureId ? `${origin}/academy#lecture-${lectureId}` : `${origin}/academy`;
}
