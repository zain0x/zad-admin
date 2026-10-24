import type { Prisma } from "@prisma/client";
import { emailFingerprint } from "@/lib/breach/fingerprint";

export type CheckFilters = { q?: string; breached?: string; company?: string; from?: string; to?: string; page?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Dates are Amman days (UTC+3): from 00:00 to 23:59 local. */
export function buildChecksWhere(f: CheckFilters): Prisma.BreachCheckStatWhereInput {
    const where: Prisma.BreachCheckStatWhereInput = {};
    if (f.breached === "1") where.breachCount = { gt: 0 };
    if (f.company === "1") where.isCompany = true;
    const q = f.q?.trim().toLowerCase().replace(/^@/, "").slice(0, 100);
    if (q) {
        // A full address is matched through its fingerprint (the stored copy is encrypted).
        const hash = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q) ? emailFingerprint(q) : null;
        where.OR = hash ? [{ emailHash: hash }] : [{ emailDomain: { contains: q } }, { emailMasked: { contains: q } }];
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (f.from && DATE.test(f.from)) createdAt.gte = new Date(`${f.from}T00:00:00+03:00`);
    if (f.to && DATE.test(f.to)) createdAt.lte = new Date(`${f.to}T23:59:59+03:00`);
    if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
    return where;
}
