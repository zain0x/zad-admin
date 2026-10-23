import { readFileSync } from "node:fs";
import path from "node:path";
import type { Certificate } from "@prisma/client";
import { buildMatrix } from "@/lib/qr/qr";
import { arDate } from "./format";
import { TYPE_TITLES, describe, type CertDetails } from "./types";

/**
 * Renders certificates as a standalone HTML document (fonts embedded) that matches the
 * approved design 1:1. The same HTML is shown in the dashboard preview and printed to PDF.
 */

const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p));

function cleanSvg(svg: string) {
    return svg.replace(/<metadata>[\s\S]*?<\/metadata>/g, "").replace(/\s+xmlns:c2pa="[^"]*"/g, "");
}

let assets: { css: string; logo: string; signature: string; mark: string } | null = null;
function loadAssets() {
    if (assets) return assets;
    const font = (file: string, weight: number) =>
        `@font-face{font-family:Zad;src:url(data:font/ttf;base64,${read("public", "fonts", file).toString("base64")}) format("truetype");font-weight:${weight}}`;
    const fonts = [
        font("GraphikArabic-Light.ttf", 300),
        font("GraphikArabic-Regular.ttf", 400),
        font("GraphikArabic-Medium.ttf", 500),
        font("GraphikArabic-Bold.ttf", 700),
    ].join("");
    const icon = cleanSvg(read("public", "brand", "zad-icon-primary.svg").toString()).replace(/#[0-9a-fA-F]{6}/g, "#ffffff");
    assets = {
        css: fonts + read("lib", "certificates", "assets", "certificate.css").toString(),
        logo: cleanSvg(read("public", "brand", "zad-logo-primary.svg").toString()),
        signature: read("lib", "certificates", "assets", "signature.svg").toString(),
        mark: `data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`,
    };
    return assets;
}

const esc = (s: unknown) =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

function qrSvg(url: string) {
    const m = buildMatrix(url);
    const n = m.length;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c} ${r}h1v1h-1z`;
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#27093c"/></svg>`;
}

export function verifyUrl(code: string) {
    const base = (process.env.CERT_VERIFY_BASE_URL || "https://zad.gg/cert").replace(/\/+$/, "");
    return `${base}/${code}`;
}

/** Long English names step down in size so they always fit on one line. */
function nameSize(name: string) {
    const n = name.length;
    return n <= 22 ? 52 : n <= 28 ? 44 : n <= 34 ? 38 : 32;
}

type Renderable = Pick<Certificate, "code" | "type" | "nameAr" | "nameEn" | "gender" | "details" | "issuedAt" | "status">;

function section(c: Renderable, a: ReturnType<typeof loadAssets>) {
    const t = TYPE_TITLES[c.type];
    const info = describe(c.type, c.gender, c.details as CertDetails);
    const url = verifyUrl(c.code);
    const facts = info.facts
        .filter((f) => f.value)
        .map((f) => `<div class="fact"><span class="fl">${esc(f.ar)} <i>${esc(f.en)}</i></span><span class="fv">${esc(f.value)}</span></div>`)
        .join("");
    const factCount = info.facts.filter((f) => f.value).length || 1;
    const skills = info.skills.length
        ? `<div class="skills"><span class="fl">المهارات <i>Skills</i></span><div class="chips">${info.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div></div>`
        : "";
    const shortHost = url.replace(/^https?:\/\//, "").replace(c.code, "");
    return `
<section class="cert">
  <div class="main">
    <header><div class="logo">${a.logo}</div></header>
    <div class="content">
      <h1>${esc(t.ar)}</h1>
      <p class="en title-en">${esc(t.en)}</p>
      <p class="en name" style="font-size:${nameSize(c.nameEn)}px">${esc(c.nameEn)}</p>
      <p class="name-ar">${esc(c.nameAr)}</p>
      <p class="body">${esc(info.bodyAr)}</p>
      <p class="en body-en">${esc(info.bodyEn)}</p>
      <div class="facts" style="grid-template-columns:repeat(${factCount},1fr)">${facts}</div>
      ${skills}
    </div>
    <footer>
      <div class="sign">
        <div class="script">${a.signature}</div>
        <b>Zein Eddin Alhasanat</b>
        <span>Founder &amp; CEO</span>
      </div>
      <div class="issued"><span class="fl">تاريخ الإصدار <i>Issued</i></span><b>${esc(arDate(c.issuedAt))}</b></div>
    </footer>
  </div>
  <aside class="band">
    <img class="mark" src="${a.mark}" alt="">
    <div class="qr">${qrSvg(url)}</div>
    <p class="vt">امسح للتحقق</p>
    <p class="en vs">Scan to verify</p>
    <p class="en url">${esc(shortHost)}<br>${esc(c.code)}</p>
    <div class="idbox"><span>رقم الشهادة · <span class="en">Certificate No</span></span><b class="en">${esc(c.code)}</b></div>
  </aside>
</section>`;
}

export function renderCertificatesHtml(certs: Renderable[], opts: { preview?: boolean } = {}) {
    const a = loadAssets();
    // In the dashboard preview the page is scaled to the iframe width.
    const previewCss = opts.preview
        ? `html,body{background:#eee8f3}body{overflow:hidden}.cert{transform-origin:top right;transform:scale(var(--s,1));box-shadow:0 8px 30px rgba(39,9,60,.15)}`
        : "";
    const previewJs = opts.preview
        ? `<script>function f(){document.documentElement.style.setProperty('--s',Math.min(1,innerWidth/1123))}addEventListener('resize',f);f()</script>`
        : "";
    const revoked = opts.preview && certs[0]?.status === "REVOKED"
        ? `<div style="position:fixed;inset:0;display:grid;place-items:center;pointer-events:none"><span style="font:700 64px Zad;color:rgba(220,38,38,.55);border:6px solid rgba(220,38,38,.55);padding:8px 28px;border-radius:16px;transform:rotate(-12deg)">ملغاة</span></div>`
        : "";
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${esc(certs.map((c) => c.code).join(", "))}</title><style>${a.css}${previewCss}</style></head><body>${certs.map((c) => section(c, a)).join("")}${revoked}${previewJs}</body></html>`;
}
