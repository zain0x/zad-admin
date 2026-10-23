/** Minimal CSV parser (quotes, commas, CRLF, UTF-8 BOM). Excel: Save As → "CSV UTF-8". */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    const s = text.replace(/^﻿/, "");
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (quoted) {
            if (ch === '"') {
                if (s[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else quoted = false;
            } else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === "," || ch === ";" || ch === "\t") {
            row.push(cell);
            cell = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && s[i + 1] === "\n") i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else cell += ch;
    }
    if (cell || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim()));
}

/** Header names accepted for each column (Arabic or English). */
const HEADERS: Record<"nameAr" | "nameEn" | "gender" | "email", string[]> = {
    nameAr: ["name_ar", "arabic name", "الاسم بالعربي", "الاسم العربي", "الاسم"],
    nameEn: ["name_en", "english name", "الاسم بالإنجليزي", "الاسم بالانجليزي", "الاسم الإنجليزي", "name"],
    gender: ["gender", "الجنس"],
    email: ["email", "e-mail", "الإيميل", "الايميل", "البريد", "البريد الإلكتروني"],
};

export type CsvPerson = { line: number; nameAr: string; nameEn: string; gender: string; email: string };

export function readPeople(text: string): { people: CsvPerson[] } | { error: string } {
    const rows = parseCsv(text);
    if (rows.length < 2) return { error: "الملف فارغ أو بدون صفوف بعد العناوين." };
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (k: keyof typeof HEADERS) => head.findIndex((h) => HEADERS[k].includes(h));
    const idx = { nameAr: col("nameAr"), nameEn: col("nameEn"), gender: col("gender"), email: col("email") };
    if (idx.nameAr < 0 || idx.nameEn < 0) return { error: "لازم يكون في الملف عمودان: name_ar و name_en (حمّل النموذج)." };
    const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const people = rows.slice(1).map((r, i) => ({
        line: i + 2,
        nameAr: get(r, idx.nameAr),
        nameEn: get(r, idx.nameEn),
        gender: get(r, idx.gender),
        email: get(r, idx.email),
    }));
    if (people.length > 500) return { error: "الحد الأقصى 500 شخص في الملف الواحد." };
    return { people };
}
