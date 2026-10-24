import { after, NextResponse, type NextRequest } from "next/server";
import type { Gender } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkServerCall } from "@/lib/server-to-server";
import { INTERNSHIPS_OPEN, INTERNSHIP_FIELDS, getSetting, lectureState, newRegistrationCode } from "@/lib/academy";
import { saveUploadBytes } from "@/lib/uploads";
import { alertTelegram, esc } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024 * 1024; // a 5 MB PDF is ~6.7 MB in base64
const MAX_CV_BYTES = 5 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()\-]{7,20}$/;
const NAME_EN = /^[A-Za-z][A-Za-z .'\-]*$/;

function str(v: unknown, max: number): string {
    return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}
function json(body: unknown, status = 200) {
    return NextResponse.json(body, { status });
}
const gender = (v: unknown): Gender => (v === "FEMALE" ? "FEMALE" : "MALE");

function person(b: Record<string, unknown>, englishName = true) {
    const nameAr = str(b.nameAr, 160);
    const nameEn = str(b.nameEn, 160);
    const email = str(b.email, 191).toLowerCase();
    const phone = str(b.phone, 40);
    if (nameAr.length < 2) return { error: "اكتب اسمك بالعربي." } as const;
    if ((englishName || nameEn) && (nameEn.length < 2 || !NAME_EN.test(nameEn))) return { error: "اكتب اسمك بالإنجليزي بأحرف إنجليزية (يُطبع على الشهادة)." } as const;
    if (!EMAIL.test(email)) return { error: "البريد الإلكتروني غير صحيح." } as const;
    if (!PHONE.test(phone)) return { error: "رقم الهاتف غير صحيح." } as const;
    return { nameAr, nameEn, email, phone, gender: gender(b.gender) } as const;
}

class Refused extends Error {
    constructor(
        public code: string,
        public messageAr: string
    ) {
        super(code);
    }
}

/**
 * From zad-landing: lecture registrations and internship applications.
 * Signed like /api/ingest/security: HMAC-SHA256(INGEST_SECRET, "<ts>.<body>").
 */
export async function POST(req: NextRequest) {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json({ error: "too large" }, 413);
    const check = checkServerCall(req, raw);
    if (!check.ok) return json({ error: check.reason }, check.reason === "disabled" ? 503 : 401);

    let b: Record<string, unknown>;
    try {
        b = JSON.parse(raw);
    } catch {
        return json({ error: "invalid json" }, 400);
    }

    // ─── Lecture registration ─────────────────────────────────────────
    if (b.kind === "lecture_registration") {
        const p = person(b);
        if ("error" in p) return json({ ok: false, code: "invalid", message: p.error }, 422);
        const lectureId = str(b.lectureId, 40);

        try {
            const result = await db.$transaction(async (tx) => {
                // Lock the lecture row so two people can't take the last seat at the same time.
                const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM lectures WHERE id = ${lectureId} FOR UPDATE`;
                if (!locked.length) throw new Refused("not_found", "المحاضرة غير موجودة.");
                const l = await tx.lecture.findUniqueOrThrow({ where: { id: lectureId } });
                const confirmed = await tx.lectureRegistration.count({ where: { lectureId, status: "CONFIRMED" } });
                const existing = await tx.lectureRegistration.findUnique({ where: { lectureId_email: { lectureId, email: p.email } } });
                if (existing?.status === "CONFIRMED") throw new Refused("already", "هذا الإيميل مسجّل بالمحاضرة مسبقاً. راجع بريدك أو تواصل معنا إذا ضاع رمز التسجيل.");

                const state = lectureState(l, confirmed);
                if (state !== "open") {
                    const msg = {
                        full: "للأسف اكتمل العدد في هذه المحاضرة.",
                        deadline: "انتهى موعد التسجيل في هذه المحاضرة.",
                        closed: "للأسف اكتمل العدد في هذه المحاضرة.",
                        past: "هذه المحاضرة انتهت.",
                        draft: "المحاضرة غير موجودة.",
                    }[state];
                    throw new Refused(state, msg);
                }

                const code = await newRegistrationCode();
                const data = { code, nameAr: p.nameAr, nameEn: p.nameEn, gender: p.gender, phone: p.phone, status: "CONFIRMED" as const, cancelledAt: null, attended: false };
                const reg = existing
                    ? await tx.lectureRegistration.update({ where: { id: existing.id }, data })
                    : await tx.lectureRegistration.create({ data: { ...data, lectureId, email: p.email } });
                return { reg, l, seatsLeft: l.capacity - confirmed - 1 };
            });

            await audit({ actorId: null, action: "lecture.registered", targetType: "lecture", targetId: lectureId, details: { email: p.email, code: result.reg.code } });
            const left = Math.max(0, result.seatsLeft);
            const taken = result.l.capacity - left;
            after(async () => {
                await alertTelegram(
                    "registration",
                    [`الاسم: ${esc(p.nameAr)}`, `المحاضرة: <b>${esc(result.l.titleAr)}</b>`, `المقاعد: ${taken} من ${result.l.capacity} · ${left ? `باقي <b>${left}</b>` : "<b>اكتمل العدد</b>"}`],
                    `/academy/${lectureId}`
                );
                if (left === 0) {
                    await alertTelegram("lecture_full", [`<b>${esc(result.l.titleAr)}</b>`, `انحجزت كل المقاعد (${result.l.capacity})، والتسجيل تسكّر لحاله.`], `/academy/${lectureId}`);
                }
            });
            return json({
                ok: true,
                code: result.reg.code,
                seatsLeft: Math.max(0, result.seatsLeft),
                lecture: {
                    titleAr: result.l.titleAr,
                    startsAt: result.l.startsAt.toISOString(),
                    mode: result.l.mode,
                    location: result.l.mode === "IN_PERSON" ? result.l.location : null,
                    onlineUrl: result.l.mode === "ONLINE" ? result.l.onlineUrl : null,
                },
            });
        } catch (e) {
            if (e instanceof Refused) return json({ ok: false, code: e.code, message: e.messageAr }, 409);
            console.error("lecture registration failed", e);
            return json({ ok: false, code: "error", message: "صار خطأ، جرّب مرة ثانية." }, 500);
        }
    }

    // ─── Internship application ───────────────────────────────────────
    if (b.kind === "internship_application") {
        if (!(await getSetting<boolean>(INTERNSHIPS_OPEN, true))) {
            return json({ ok: false, code: "closed", message: "استقبال طلبات التدريب متوقف حالياً." }, 409);
        }
        const p = person(b, false);
        if ("error" in p) return json({ ok: false, code: "invalid", message: p.error }, 422);
        const university = str(b.university, 200);
        const field = str(b.field, 100);
        if (university.length < 2) return json({ ok: false, code: "invalid", message: "اكتب اسم جامعتك." }, 422);
        if (!INTERNSHIP_FIELDS.includes(field)) return json({ ok: false, code: "invalid", message: "اختر مجال التدريب." }, 422);

        // One open application per email at a time.
        const dup = await db.internshipApplication.findFirst({
            where: { email: p.email, status: { in: ["NEW", "REVIEWING", "ACCEPTED", "ACTIVE"] } },
            select: { id: true },
        });
        if (dup) return json({ ok: false, code: "already", message: `عندك طلب قيد المتابعة (#${dup.id}). رح نتواصل معك قريباً.` }, 409);

        let cvKey: string | null = null;
        let cvName: string | null = null;
        if (typeof b.cvBase64 === "string" && b.cvBase64) {
            const buf = Buffer.from(b.cvBase64, "base64");
            if (buf.length > MAX_CV_BYTES) return json({ ok: false, code: "invalid", message: "السيرة الذاتية أكبر من 5 ميجا." }, 422);
            if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return json({ ok: false, code: "invalid", message: "السيرة الذاتية لازم تكون PDF." }, 422);
            cvKey = await saveUploadBytes(buf, "pdf");
            cvName = str(b.cvName, 200) || "cv.pdf";
        }

        const a = await db.internshipApplication.create({
            data: {
                ...p,
                university,
                field,
                major: str(b.major, 200) || null,
                studyYear: str(b.studyYear, 60) || null,
                bio: typeof b.bio === "string" ? b.bio.trim().slice(0, 3000) || null : null,
                cvKey,
                cvName,
            },
        });
        await audit({ actorId: null, action: "internship.applied", targetType: "internship", targetId: String(a.id), details: { field } });
        after(() =>
            alertTelegram(
                "internship",
                [`رقم الطلب: <b>#${a.id}</b>`, `الاسم: ${esc(a.nameAr)}`, `الجامعة: ${esc(a.university)}`, `التخصص: ${esc(a.major || "—")}`, `المجال: <b>${esc(a.field)}</b>`],
                `/academy/internships/${a.id}`
            )
        );
        return json({ ok: true, id: a.id });
    }

    return json({ error: "unknown kind" }, 400);
}
