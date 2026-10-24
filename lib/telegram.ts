import { getSetting } from "@/lib/academy";

/**
 * Telegram alerts for the team channel. Token and chat id live in .env (never in the database):
 *   TELEGRAM_BOT_TOKEN  from @BotFather
 *   TELEGRAM_CHAT_ID    the channel/group id, e.g. -1001234567890
 *   ADMIN_URL           public dashboard address, for the "open" button (skipped for localhost)
 * Never throws: a Telegram outage must not break the request that triggered the alert.
 */

export const TELEGRAM_EVENTS = {
    internship: { label: "طلب تدريب جديد", emoji: "🎓", group: "أكاديمية زاد" },
    registration: { label: "حجز جديد بمحاضرة", emoji: "🎟️", group: "أكاديمية زاد" },
    lecture_full: { label: "محاضرة اكتمل عددها", emoji: "🔴", group: "أكاديمية زاد" },
    lecture_reminder: { label: "تذكير قبل المحاضرة بيوم", emoji: "⏰", group: "أكاديمية زاد" },
    scan_site: { label: "طلب فحص موقع جديد", emoji: "🛡️", group: "Zad Security" },
    scan_leak: { label: "طلب فحص تسريبات جديد", emoji: "🔍", group: "Zad Security" },
    breach_check: { label: "حدا فحص إيميله بالموقع", emoji: "📧", group: "Zad Security" },
    notify: { label: "اشتراك بتنبيهات التسريبات", emoji: "🔔", group: "Zad Security" },
} as const;

export type TelegramEvent = keyof typeof TELEGRAM_EVENTS;
export const TELEGRAM_SETTING = "telegram.events";

export function telegramConfigured() {
    return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Which alerts are switched on (all on by default). */
export async function telegramEvents(): Promise<Record<TelegramEvent, boolean>> {
    const saved = await getSetting<Record<string, boolean>>(TELEGRAM_SETTING, {});
    return Object.fromEntries(Object.keys(TELEGRAM_EVENTS).map((k) => [k, saved[k] !== false])) as Record<TelegramEvent, boolean>;
}

export function esc(v: unknown) {
    return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "zein@icloud.com" → "ze•••@icloud.com" */
export function maskEmail(email: string) {
    const [local, domain] = email.split("@");
    if (!domain) return "•••";
    return `${local.slice(0, local.length <= 2 ? 1 : 2)}•••@${domain}`;
}

function buttonUrl(path?: string) {
    const base = process.env.ADMIN_URL?.replace(/\/+$/, "");
    if (!path || !base || !/^https:\/\//.test(base) || /localhost|127\.0\.0\.1/.test(base)) return null;
    return `${base}${path}`;
}

/** Sends one message. Returns false (and logs) on any failure. */
export async function sendTelegram(html: string, openPath?: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;
    const url = buttonUrl(openPath);
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: html,
                parse_mode: "HTML",
                disable_web_page_preview: true,
                ...(url ? { reply_markup: { inline_keyboard: [[{ text: "فتح باللوحة", url }]] } } : {}),
            }),
            signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) {
            // Don't log the URL: it contains the bot token.
            console.error(`Telegram send failed: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error("Telegram send error:", err instanceof Error ? err.message : err);
        return false;
    }
}

/** Sends an alert if Telegram is set up and this event is switched on. */
export async function alertTelegram(event: TelegramEvent, lines: (string | null | false | undefined)[], openPath?: string) {
    if (!telegramConfigured()) return;
    try {
        if (!(await telegramEvents())[event]) return;
        const e = TELEGRAM_EVENTS[event];
        await sendTelegram([`${e.emoji} <b>${esc(e.label)}</b>`, "", ...lines.filter(Boolean)].join("\n"), openPath);
    } catch (err) {
        console.error("Telegram alert error:", err);
    }
}
