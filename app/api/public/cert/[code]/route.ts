import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkServerCall } from "@/lib/server-to-server";
import { normaliseCode } from "@/lib/certificates/code";
import { TYPE_TITLES, describe, type CertDetails } from "@/lib/certificates/types";
import { arDate } from "@/lib/certificates/format";

export const dynamic = "force-dynamic";

/**
 * What zad.gg/cert/<code> shows. Called server-to-server by zad-landing, signed with
 * INGEST_SECRET over "GET /api/public/cert/<code>". Returns only what is printed on the certificate.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const code = normaliseCode((await params).code);
    const check = checkServerCall(req, `GET /api/public/cert/${code}`);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: check.reason === "disabled" ? 503 : 401 });

    const c = await db.certificate.findUnique({ where: { code } });
    if (!c) return NextResponse.json({ found: false }, { status: 404 });

    const info = describe(c.type, c.gender, c.details as CertDetails);
    return NextResponse.json({
        found: true,
        code: c.code,
        status: c.status,
        type: c.type,
        title: TYPE_TITLES[c.type],
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        bodyAr: info.bodyAr,
        facts: info.facts.filter((f) => f.value),
        issuedAt: arDate(c.issuedAt),
        revokedAt: c.revokedAt ? arDate(c.revokedAt) : null,
    });
}
