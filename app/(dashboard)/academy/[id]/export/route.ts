import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { routeUser } from "@/lib/auth/route-auth";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/utils";

function cell(v: unknown) {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

/** Registrations as CSV (opens in Excel with Arabic intact). Same columns as the certificate bulk file. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await routeUser();
    if (!auth || !can(auth.user, "lectures")) return NextResponse.redirect(new URL("/login", req.url));
    const id = (await params).id;
    const l = await db.lecture.findUnique({ where: { id }, include: { registrations: { orderBy: { createdAt: "asc" } } } });
    if (!l) return new NextResponse("Not found", { status: 404 });
    const head = ["name_ar", "name_en", "gender", "email", "phone", "code", "status", "attended", "registered_at"];
    const lines = l.registrations.map((r) =>
        [r.nameAr, r.nameEn, r.gender === "FEMALE" ? "أنثى" : "ذكر", r.email, r.phone, r.code, r.status === "CONFIRMED" ? "مؤكد" : "ملغى", r.attended ? "نعم" : "", formatDateTime(r.createdAt)]
            .map(cell)
            .join(",")
    );
    await audit({ actorId: auth.user.id, action: "lecture.registrations_exported", targetType: "lecture", targetId: id, details: { rows: lines.length } });
    return new NextResponse("﻿" + [head.map(cell).join(","), ...lines].join("\r\n"), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="lecture-registrations-${id}.csv"`,
            "Cache-Control": "no-store",
        },
    });
}
