"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { setSetting } from "@/lib/academy";
import { TELEGRAM_EVENTS, TELEGRAM_SETTING, sendTelegram, telegramConfigured } from "@/lib/telegram";

export type TestState = { ok?: string; error?: string } | undefined;

export async function saveTelegramEventsAction(form: FormData) {
    const { user } = await requireAdmin();
    const value = Object.fromEntries(Object.keys(TELEGRAM_EVENTS).map((k) => [k, form.get(k) === "on"]));
    await setSetting(TELEGRAM_SETTING, value);
    await audit({ actorId: user.id, action: "telegram.updated", details: value });
    revalidatePath("/settings/telegram");
}

export async function testTelegramAction(): Promise<TestState> {
    const { user } = await requireAdmin();
    if (!telegramConfigured()) return { error: "أضف TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID بملف .env وأعد تشغيل اللوحة." };
    const ok = await sendTelegram(`✅ <b>رسالة تجربة من لوحة زاد</b>\n\nالتنبيهات شغالة. أرسلها ${user.name.replace(/[<>&]/g, "")}.`, "/settings/telegram");
    return ok ? { ok: "وصلت الرسالة؟ شيك القناة." } : { error: "ما قدرت أبعث. تأكد إنه البوت مضاف كأدمن بالقناة وإنه رقم القناة صحيح (بيبلّش بـ -100)." };
}
