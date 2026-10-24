import type { Browser } from "playwright";
import { renderCertificatesHtml } from "./template";

/**
 * Prints HTML to PDF/PNG with headless Chromium, so Arabic shaping and the design match the
 * browser exactly. Used for certificates and scan reports. One browser is kept alive and reused.
 * Setup once per machine:  npm run pdf:install
 */
let browserPromise: Promise<Browser> | null = null;

async function getBrowser() {
    if (!browserPromise) {
        browserPromise = import("playwright").then(({ chromium }) =>
            chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] })
        );
        browserPromise.catch(() => {
            browserPromise = null;
        });
    }
    const b = await browserPromise;
    if (!b.isConnected()) {
        browserPromise = null;
        return getBrowser();
    }
    return b;
}

/** Any standalone HTML document → PDF. Defaults to A4 portrait with the page's own @page rules. */
export async function htmlToPdf(html: string, size: { width: string; height: string } | { format: "A4" } = { format: "A4" }): Promise<Buffer> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        const pdf = await page.pdf({ ...size, printBackground: true, preferCSSPageSize: true });
        return Buffer.from(pdf);
    } finally {
        await page.close();
    }
}

type Certs = Parameters<typeof renderCertificatesHtml>[0];

export function certificatesPdf(certs: Certs): Promise<Buffer> {
    return htmlToPdf(renderCertificatesHtml(certs), { width: "1123px", height: "794px" });
}

/** One certificate as a sharp PNG (2×). A revoked certificate carries a "ملغاة" stamp. */
export async function certificatePng(cert: Certs[number]): Promise<Buffer> {
    const browser = await getBrowser();
    const page = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 2 });
    try {
        await page.setContent(renderCertificatesHtml([cert], { stamp: true }), { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        return Buffer.from(await page.screenshot({ type: "png" }));
    } finally {
        await page.close();
    }
}
