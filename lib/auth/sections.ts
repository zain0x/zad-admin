import type { User } from "@prisma/client";

/** Dashboard sections a staff member can be given. Admins always have all of them. Safe for client components. */
export type Section = "certificates" | "sites" | "emails" | "lectures" | "internships";

type PermField = "permCertificates" | "permSites" | "permEmails" | "permLectures" | "permInternships";

export const SECTIONS: { key: Section; label: string; field: PermField; hint: string }[] = [
    { key: "sites", label: "فحص المواقع", field: "permSites", hint: "يرى طلبات الفحص المسندة له فقط" },
    { key: "emails", label: "مراقبة الإيميلات", field: "permEmails", hint: "يرى ويضيف الإيميلات المراقبة" },
    { key: "certificates", label: "الشهادات", field: "permCertificates", hint: "يصدر الشهادات ويعدّلها ويلغيها" },
    { key: "lectures", label: "المحاضرات", field: "permLectures", hint: "يضيف المحاضرات ويدير المسجلين" },
    { key: "internships", label: "التدريب", field: "permInternships", hint: "يراجع طلبات تدريب الطلاب" },
];

type PermUser = Pick<User, "role" | PermField>;

export function can(user: PermUser, section: Section) {
    if (user.role === "ADMIN") return true;
    const field = SECTIONS.find((s) => s.key === section)!.field;
    return user[field] === true;
}

export function sectionsOf(user: PermUser): Record<Section, boolean> {
    return {
        certificates: can(user, "certificates"),
        sites: can(user, "sites"),
        emails: can(user, "emails"),
        lectures: can(user, "lectures"),
        internships: can(user, "internships"),
    };
}
