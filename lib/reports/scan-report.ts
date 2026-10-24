import type { Finding, ScanRequest, User } from "@prisma/client";
import { brandAssets } from "@/lib/certificates/template";
import { arDate } from "@/lib/certificates/format";
import { SEVERITY, SEVERITY_ORDER, TYPE_LABELS } from "@/lib/requests";

/** A4 security report for a scan request, built from its findings. Printed with Chromium. */

const esc = (s: unknown) =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

/** Plain text with line breaks kept. */
const para = (s: string | null | undefined) => (s ? esc(s).replace(/\n/g, "<br>") : "");

type Input = ScanRequest & { assignee: Pick<User, "name"> | null; findings: Finding[] };

const CSS = `
:root{--p:#ad72fe;--d:#27093c;--muted:#6b5a7e;--line:#ece4f7;--soft:#f7f2fe}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Zad,system-ui,sans-serif;color:var(--d);font-size:13px;line-height:1.75}
.en{direction:ltr;unicode-bidi:isolate}
@page{size:A4;margin:18mm 16mm 20mm}
.cover{height:257mm;display:flex;flex-direction:column;break-after:page}
.cover .logo svg{height:56px;width:auto}
.cover .band{margin-top:auto;background:var(--d);color:#fff;border-radius:18px;padding:34px 32px}
.cover h1{font-size:36px;line-height:1.25}
.cover .sub{color:var(--p);letter-spacing:.2em;text-transform:uppercase;font-size:12px;margin-top:6px}
.cover .target{margin-top:26px;font-size:20px;font-weight:700;word-break:break-all}
.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px;margin-top:26px}
.meta dt{font-size:11px;color:rgba(255,255,255,.6)}.meta dd{font-size:14px;font-weight:500}
.conf{margin-top:18px;font-size:11px;color:var(--muted)}
h2{font-size:20px;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line)}
section{margin-bottom:26px}
.counts{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
.count{border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center}
.count b{display:block;font-size:24px;line-height:1.2}.count span{font-size:11px;color:var(--muted)}
.summary{background:var(--soft);border-radius:12px;padding:14px 16px}
.toc{width:100%;border-collapse:collapse}
.toc td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.sev{display:inline-block;color:#fff;border-radius:6px;padding:1px 9px;font-size:11px;font-weight:700;white-space:nowrap}
.finding{border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:14px;break-inside:avoid}
.finding h3{font-size:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.finding .num{color:var(--muted);font-weight:500}
.finding .fixed{color:#047857;font-size:11px;border:1px solid #a7f3d0;border-radius:6px;padding:0 8px}
.finding h4{font-size:12px;color:var(--muted);margin-top:10px}
.finding .aff{font-family:ui-monospace,monospace;font-size:12px;background:var(--soft);border-radius:6px;padding:2px 8px;display:inline-block;margin-top:4px;word-break:break-all}
.empty{color:var(--muted)}
`;

export function renderScanReportHtml(r: Input) {
    const { fonts, logo } = brandAssets();
    const findings = [...r.findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    const count = (s: (typeof SEVERITY_ORDER)[number]) => findings.filter((f) => f.severity === s).length;
    const date = arDate(r.closedAt ?? new Date());
    const sev = (s: Finding["severity"]) => `<span class="sev" style="background:${SEVERITY[s].color}">${SEVERITY[s].ar}</span>`;

    const cover = `
<div class="cover">
  <div class="logo">${logo}</div>
  <div class="band">
    <h1>تقرير الفحص الأمني</h1>
    <p class="en sub">Security Assessment Report</p>
    <p class="en target">${esc(r.target ?? "—")}</p>
    <dl class="meta">
      <div><dt>العميل</dt><dd>${esc(r.name ?? r.email)}</dd></div>
      <div><dt>نوع الفحص</dt><dd>${esc(TYPE_LABELS[r.type])}</dd></div>
      <div><dt>رقم الطلب</dt><dd>#${r.id}</dd></div>
      <div><dt>تاريخ التقرير</dt><dd>${esc(date)}</dd></div>
      <div><dt>أعدّه</dt><dd>${esc(r.assignee?.name ?? "فريق Zad Security")}</dd></div>
      <div><dt>عدد الملاحظات</dt><dd>${findings.length}</dd></div>
    </dl>
  </div>
  <p class="conf">سري: هذا التقرير مُعد للعميل فقط، ولا يجوز مشاركته دون إذنه.</p>
</div>`;

    const summary = `
<section>
  <h2>الملخص</h2>
  <div class="counts">
    ${SEVERITY_ORDER.map((s) => `<div class="count"><b style="color:${SEVERITY[s].color}">${count(s)}</b><span>${SEVERITY[s].ar}</span></div>`).join("")}
  </div>
  ${r.summary ? `<div class="summary">${para(r.summary)}</div>` : ""}
</section>`;

    const toc = findings.length
        ? `<section><h2>قائمة الملاحظات</h2><table class="toc">${findings
              .map((f, i) => `<tr><td style="width:36px">${i + 1}</td><td>${esc(f.title)}</td><td style="width:90px">${sev(f.severity)}</td><td style="width:90px">${f.status === "FIXED" ? "تم الإصلاح" : "مفتوحة"}</td></tr>`)
              .join("")}</table></section>`
        : `<section><h2>قائمة الملاحظات</h2><p class="empty">لم تُسجّل أي ثغرات في هذا الفحص.</p></section>`;

    const details = findings.length
        ? `<section><h2>التفاصيل</h2>${findings
              .map(
                  (f, i) => `
<div class="finding">
  <h3><span class="num">${i + 1}.</span> ${esc(f.title)} ${sev(f.severity)} ${f.status === "FIXED" ? '<span class="fixed">تم الإصلاح</span>' : ""}</h3>
  ${f.affected ? `<h4>المكان المتأثر</h4><span class="en aff">${esc(f.affected)}</span>` : ""}
  <h4>الوصف</h4><p>${para(f.description)}</p>
  ${f.steps ? `<h4>خطوات إعادة الإنتاج</h4><p>${para(f.steps)}</p>` : ""}
  ${f.recommendation ? `<h4>التوصية</h4><p>${para(f.recommendation)}</p>` : ""}
</div>`
              )
              .join("")}</section>`
        : "";

    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الفحص #${r.id}</title><style>${fonts}${CSS}</style></head><body>${cover}${summary}${toc}${details}</body></html>`;
}
