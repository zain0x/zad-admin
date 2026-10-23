/** Arabic text helpers for certificates. Dates use Egyptian-style month names (أكتوبر) with Latin digits. */

const dayMonthYear = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" });

/** "2026-10-20" or a Date → "20 أكتوبر 2026" */
export function arDate(d: Date | string): string {
    return dayMonthYear.format(typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d);
}

/** "1 يوليو – 30 سبتمبر 2026", or with both years when they differ. */
export function arPeriod(start: string, end: string): string {
    const s = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
    return `${sameYear ? dayMonth.format(s) : dayMonthYear.format(s)} – ${dayMonthYear.format(e)}`;
}

/** Arabic count of hours: ساعة واحدة، ساعتان، 3 ساعات، 24 ساعة */
export function arHours(n: number): string {
    if (n === 1) return "ساعة واحدة";
    if (n === 2) return "ساعتان";
    if (n >= 3 && n <= 10) return `${n} ساعات`;
    return `${n} ساعة`;
}

/** Today in Amman as YYYY-MM-DD (for default form values). */
export function todayIso(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
}

export function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}
