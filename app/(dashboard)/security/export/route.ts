import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { STATUS_LABELS, TYPE_LABELS, buildRequestWhere } from "@/lib/requests";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Quote a CSV cell; a leading = + - @ is neutralised so Excel never runs it as a formula. */
function cell(v: unknown) {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
    const auth = await getAuth();
    if (!auth || !auth.session.twoFactorPassed || auth.user.mustChangePassword || !can(auth.user, "sites")) {
        return NextResponse.redirect(new URL("/login", req.url));
    }
    const sp = req.nextUrl.searchParams;
    const filters = { status: sp.get("status") ?? undefined, type: sp.get("type") ?? undefined, q: sp.get("q") ?? undefined, mine: sp.get("mine") ?? undefined };
    const rows = await db.scanRequest.findMany({
        where: buildRequestWhere(filters, auth.user),
        orderBy: { createdAt: "desc" },
        take: 10_000,
        include: { assignee: { select: { name: true } } },
    });

    const header = ["#", "النوع", "الحالة", "الاسم", "البريد", "الهاتف", "الموقع", "المسؤول", "تاريخ الطلب"];
    const lines = rows.map((r) =>
        [r.id, TYPE_LABELS[r.type], STATUS_LABELS[r.status], r.name, r.email, r.phone, r.target, r.assignee?.name, formatDateTime(r.createdAt)]
            .map(cell)
            .join(",")
    );
    // BOM so Excel opens Arabic correctly.
    const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");

    await audit({ actorId: auth.user.id, action: "request.exported", details: { rows: rows.length, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) } });

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="zad-security-requests-${date}.csv"`,
            "Cache-Control": "no-store",
        },
    });
}
