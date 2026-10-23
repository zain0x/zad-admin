import type { Browser } from "playwright";
import { renderCertificatesHtml } from "./template";

/**
 * Prints certificates to PDF with headless Chromium, so Arabic shaping and the design
 * match the browser preview exactly. One browser is kept alive and reused.
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

export async function certificatesPdf(certs: Parameters<typeof renderCertificatesHtml>[0]): Promise<Buffer> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(renderCertificatesHtml(certs), { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        const pdf = await page.pdf({ width: "1123px", height: "794px", printBackground: true, preferCSSPageSize: true });
        return Buffer.from(pdf);
    } finally {
        await page.close();
    }
}
