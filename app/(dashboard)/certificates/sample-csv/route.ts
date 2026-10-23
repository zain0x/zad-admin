import { NextResponse } from "next/server";
import { routeUser } from "@/lib/auth/route-auth";

/** A ready template for the bulk issue file (opens in Excel with Arabic intact). */
export async function GET() {
    if (!(await routeUser())) return new NextResponse("Unauthorized", { status: 401 });
    const csv = "﻿" + ["name_ar,name_en,gender,email", "سارة محمد العلي,Sara Mohammad Al-Ali,أنثى,sara@example.com", "عمر يوسف حداد,Omar Yousef Haddad,ذكر,"].join("\r\n");
    return new NextResponse(csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="zad-certificates-template.csv"' },
    });
}
