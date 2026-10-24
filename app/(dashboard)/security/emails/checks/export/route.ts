import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { routeUser } from "@/lib/auth/route-auth";
import { can } from "@/lib/auth/permissions";
import { buildChecksWhere } from "@/lib/breach/checks-query";
import { formatDateTime } from "@/lib/utils";
import { open } from "@/lib/auth/secret-box";

function emailOf(r: { emailSealed: string | null; emailMasked: string | null }) {
    if (!r.emailSealed) return r.emailMasked;
    try {
        return open(r.emailSealed);
    } catch {
        return r.emailMasked;
    }
}

export const dynamic = "force-dynamic";

function cell(v: unknown) {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
    const auth = await routeUser();
    if (!auth || !can(auth.user, "emails")) return NextResponse.redirect(new URL("/login", req.url));
    const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
    const rows = await db.breachCheckStat.findMany({ where: buildChecksWhere(sp), orderBy: { createdAt: "desc" }, take: 50000 });
    const lines = rows.map((r) =>
        [formatDateTime(r.createdAt), emailOf(r), r.emailDomain, r.isCompany ? "شركة" : "", r.breachCount, ((r.breaches as string[] | null) ?? []).join(" | ")]
            .map(cell)
            .join(",")
    );
    const csv = "﻿" + [["الوقت", "الإيميل", "الدومين", "النوع", "عدد التسريبات", "التسريبات"].map(cell).join(","), ...lines].join("\r\n");
    await audit({ actorId: auth.user.id, action: "email.checks_exported", details: { rows: rows.length } });
    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="zad-email-checks-${new Date().toISOString().slice(0, 10)}.csv"`,
            "Cache-Control": "no-store",
        },
    });
}
