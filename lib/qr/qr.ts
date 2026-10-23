import { QRCode, QRErrorCorrectLevel } from "./qrcode-core";

export type DotStyle = "square" | "rounded" | "dots";
export type CornerStyle = "square" | "rounded" | "circle";

export type QrOptions = {
    data: string;
    color: string;
    background?: string;
    dotStyle?: DotStyle;
    cornerStyle?: CornerStyle;
    /** quiet zone in modules */
    margin?: number;
    logo?: string | null;
    /** logo box size relative to the code (0–0.3) */
    logoScale?: number;
};

/** Encode text as UTF‑8 bytes packed into a binary string (the core lib writes charCode & 0xff). */
function toUtf8Binary(text: string) {
    const bytes = new TextEncoder().encode(text);
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
}

export function buildMatrix(text: string): boolean[][] {
    const qr = new QRCode(-1, QRErrorCorrectLevel.H);
    qr.addData(toUtf8Binary(text || " "));
    qr.make();
    const n: number = qr.getModuleCount();
    const m: boolean[][] = [];
    for (let r = 0; r < n; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
        m.push(row);
    }
    return m;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function inFinder(r: number, c: number, n: number) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

function finder(x: number, y: number, style: CornerStyle, color: string) {
    if (style === "circle") {
        return (
            `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="3" fill="none" stroke="${color}" stroke-width="1"/>` +
            `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.5" fill="${color}"/>`
        );
    }
    const ro = style === "rounded" ? 2 : 0;
    const ri = style === "rounded" ? 0.9 : 0;
    return (
        `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="${ro}" fill="none" stroke="${color}" stroke-width="1"/>` +
        `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${ri}" fill="${color}"/>`
    );
}

export function renderSvg(o: QrOptions, size = 1024): string {
    const m = buildMatrix(o.data);
    const n = m.length;
    const margin = o.margin ?? 2;
    const total = n + margin * 2;
    const dot = o.dotStyle ?? "rounded";
    const corner = o.cornerStyle ?? "square";
    const color = o.color;
    const bg = o.background ?? "#ffffff";

    // logo hole, in modules, centered and kept odd so it aligns with the grid
    let hole = 0;
    if (o.logo) {
        hole = Math.floor(n * (o.logoScale ?? 0.22));
        if (hole % 2 === 0) hole += 1;
    }
    const h0 = (n - hole) / 2;
    const inHole = (r: number, c: number) =>
        hole > 0 &&
        r >= h0 - 0.5 &&
        r < h0 + hole &&
        c >= h0 - 0.5 &&
        c < h0 + hole;

    const dark = (r: number, c: number) =>
        r >= 0 &&
        c >= 0 &&
        r < n &&
        c < n &&
        m[r][c] &&
        !inFinder(r, c, n) &&
        !inHole(r, c);

    let body = "";
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!dark(r, c)) continue;
            const x = c + margin;
            const y = r + margin;
            if (dot === "dots") {
                body += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.42"/>`;
            } else if (dot === "rounded") {
                // round only the corners that have no neighbours → soft, connected look
                const t = dark(r - 1, c),
                    b = dark(r + 1, c),
                    l = dark(r, c - 1),
                    rt = dark(r, c + 1);
                const k = 0.5;
                const tl = !t && !l ? k : 0,
                    tr = !t && !rt ? k : 0;
                const br = !b && !rt ? k : 0,
                    bl = !b && !l ? k : 0;
                body +=
                    `<path d="M${x + tl} ${y}H${x + 1 - tr}` +
                    (tr ? `A${tr} ${tr} 0 0 1 ${x + 1} ${y + tr}` : "") +
                    `V${y + 1 - br}` +
                    (br ? `A${br} ${br} 0 0 1 ${x + 1 - br} ${y + 1}` : "") +
                    `H${x + bl}` +
                    (bl ? `A${bl} ${bl} 0 0 1 ${x} ${y + 1 - bl}` : "") +
                    `V${y + tl}` +
                    (tl ? `A${tl} ${tl} 0 0 1 ${x + tl} ${y}` : "") +
                    `Z"/>`;
            } else {
                body += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
            }
        }
    }

    const finders =
        finder(margin, margin, corner, color) +
        finder(margin + n - 7, margin, corner, color) +
        finder(margin, margin + n - 7, corner, color);

    let logo = "";
    if (o.logo && hole > 0) {
        const pad = 0.6;
        const lx = margin + h0 + pad;
        const ls = hole - pad * 2;
        logo =
            `<clipPath id="lc"><rect x="${lx}" y="${lx}" width="${ls}" height="${ls}" rx="${ls * 0.18}"/></clipPath>` +
            `<image href="${esc(o.logo)}" x="${lx}" y="${lx}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid slice" clip-path="url(#lc)"/>`;
    }

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="geometricPrecision">` +
        `<rect width="${total}" height="${total}" fill="${bg}"/>` +
        `<g fill="${color}"${dot === "dots" ? "" : ` stroke="${color}" stroke-width="0.04"`}>${body}</g>${finders}${logo}</svg>`
    );
}

export function svgToImage(svg: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
}

export async function svgToPngBlob(svg: string, size: number): Promise<Blob> {
    const img = await svgToImage(svg);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, size, size);
    return new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

export function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
