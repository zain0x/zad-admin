import type { CertificateType, Gender } from "@prisma/client";
import { arDate, arHours, arPeriod } from "./format";

export const TYPE_LABELS: Record<CertificateType, string> = {
    INTERNSHIP: "تدريب",
    ATTENDANCE: "حضور",
    COURSE: "كورس",
};

export const TYPE_TITLES: Record<CertificateType, { ar: string; en: string }> = {
    INTERNSHIP: { ar: "شهادة إتمام تدريب", en: "Certificate of Internship Completion" },
    ATTENDANCE: { ar: "شهادة حضور", en: "Certificate of Attendance" },
    COURSE: { ar: "شهادة إتمام كورس", en: "Certificate of Course Completion" },
};

/** Stored in certificates.details (JSON). Dates are YYYY-MM-DD. */
export type CertDetails = {
    // INTERNSHIP
    departmentAr?: string;
    departmentEn?: string;
    startDate?: string;
    endDate?: string;
    skills?: string[];
    // ATTENDANCE / COURSE
    titleAr?: string;
    titleEn?: string;
    date?: string;
    // all
    hours?: number;
};

export type CertInput = {
    type: CertificateType;
    nameAr: string;
    nameEn: string;
    gender: Gender;
    email: string | null;
    issuedAt: string;
    details: CertDetails;
};

export function isCertType(v: unknown): v is CertificateType {
    return v === "INTERNSHIP" || v === "ATTENDANCE" || v === "COURSE";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(form: FormData, key: string, max = 200) {
    return String(form.get(key) ?? "").trim().slice(0, max);
}

/** The fields that change per type but are shared by every person in a bulk issue. */
export function parseDetails(type: CertificateType, form: FormData): { details: CertDetails } | { error: string } {
    const hoursRaw = str(form, "hours", 6);
    const hours = hoursRaw ? Number(hoursRaw) : undefined;
    if (hours !== undefined && (!Number.isInteger(hours) || hours < 1 || hours > 5000)) return { error: "عدد الساعات غير صحيح." };

    if (type === "INTERNSHIP") {
        const departmentAr = str(form, "departmentAr", 120);
        const startDate = str(form, "startDate", 10);
        const endDate = str(form, "endDate", 10);
        if (!departmentAr) return { error: "أدخل القسم." };
        if (!DATE.test(startDate) || !DATE.test(endDate)) return { error: "أدخل تاريخ بداية ونهاية التدريب." };
        if (startDate > endDate) return { error: "تاريخ البداية بعد تاريخ النهاية." };
        const skills = str(form, "skills", 600)
            .split(/[,،\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 6);
        return { details: { departmentAr, departmentEn: str(form, "departmentEn", 120) || undefined, startDate, endDate, skills } };
    }

    const titleAr = str(form, "titleAr", 160);
    const date = str(form, "date", 10);
    if (!titleAr) return { error: type === "COURSE" ? "أدخل اسم الكورس." : "أدخل عنوان المحاضرة." };
    if (!DATE.test(date)) return { error: type === "COURSE" ? "أدخل تاريخ الإتمام." : "أدخل تاريخ المحاضرة." };
    if (type === "COURSE") return { details: { titleAr, titleEn: str(form, "titleEn", 160) || undefined, date } };
    if (!hours) return { error: "أدخل مدة المحاضرة بالساعات." };
    return { details: { titleAr, titleEn: str(form, "titleEn", 160) || undefined, date, hours } };
}

export function parsePerson(raw: { nameAr: string; nameEn: string; gender: string; email: string }): { ok: true; nameAr: string; nameEn: string; gender: Gender; email: string | null } | { ok: false; error: string } {
    const nameAr = raw.nameAr.trim().slice(0, 160);
    const nameEn = raw.nameEn.trim().replace(/\s+/g, " ").slice(0, 160);
    const g = raw.gender.trim().toLowerCase();
    const gender: Gender | null = ["m", "male", "ذكر", "M"].includes(g) || g === "" ? "MALE" : ["f", "female", "أنثى", "انثى"].includes(g) ? "FEMALE" : null;
    const email = raw.email.trim().toLowerCase() || null;
    if (nameAr.length < 2) return { ok: false, error: "الاسم بالعربي مطلوب." };
    if (nameEn.length < 2 || !/^[A-Za-z][A-Za-z .'\-]*$/.test(nameEn)) return { ok: false, error: "الاسم بالإنجليزي مطلوب (أحرف إنجليزية فقط)." };
    if (!gender) return { ok: false, error: "الجنس: ذكر أو أنثى." };
    if (email && !EMAIL.test(email)) return { ok: false, error: "الإيميل غير صحيح." };
    return { ok: true, nameAr, nameEn, gender, email };
}

/** Everything the certificate prints, derived from the stored record. */
export function describe(type: CertificateType, gender: Gender, d: CertDetails) {
    const f = gender === "FEMALE";
    if (type === "INTERNSHIP") {
        return {
            bodyAr: `${f ? "أتمّت" : "أتمّ"} فترة التدريب العملي في قسم ${d.departmentAr} لدى زاد، ${f ? "وأظهرت" : "وأظهر"} التزاماً ومهارة في المهام الموكلة ${f ? "إليها" : "إليه"}.`,
            bodyEn: `has successfully completed a practical internship${d.departmentEn ? ` in the ${d.departmentEn} department` : ""} at Zad.`,
            facts: [
                { ar: "الفترة", en: "Period", value: d.startDate && d.endDate ? arPeriod(d.startDate, d.endDate) : "" },
                { ar: "القسم", en: "Department", value: d.departmentAr ?? "" },
            ],
            skills: d.skills ?? [],
        };
    }
    if (type === "ATTENDANCE") {
        return {
            bodyAr: `${f ? "حضرت" : "حضر"} محاضرة «${d.titleAr}» التي نظّمتها زاد.`,
            bodyEn: d.titleEn ? `attended the lecture “${d.titleEn}” organised by Zad.` : "attended a lecture organised by Zad.",
            facts: [
                { ar: "المحاضرة", en: "Lecture", value: d.titleAr ?? "" },
                { ar: "التاريخ", en: "Date", value: d.date ? arDate(d.date) : "" },
                { ar: "المدة", en: "Duration", value: d.hours ? arHours(d.hours) : "" },
            ],
            skills: [],
        };
    }
    return {
        bodyAr: `${f ? "أتمّت" : "أتمّ"} بنجاح كورس «${d.titleAr}».`,
        bodyEn: d.titleEn ? `has successfully completed the course “${d.titleEn}”.` : "has successfully completed a course at Zad.",
        facts: [
            { ar: "الكورس", en: "Course", value: d.titleAr ?? "" },
            { ar: "تاريخ الإتمام", en: "Completed", value: d.date ? arDate(d.date) : "" },
        ],
        skills: [],
    };
}
