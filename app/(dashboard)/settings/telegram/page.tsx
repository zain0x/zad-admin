import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { TELEGRAM_EVENTS, telegramConfigured, telegramEvents, type TelegramEvent } from "@/lib/telegram";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { saveTelegramEventsAction } from "./actions";
import { TestButton } from "./test-button";

export const metadata: Metadata = { title: "تنبيهات تيليقرام" };

export default async function TelegramPage() {
    await requireAdmin();
    const ready = telegramConfigured();
    const events = await telegramEvents();
    const groups = new Map<string, TelegramEvent[]>();
    for (const k of Object.keys(TELEGRAM_EVENTS) as TelegramEvent[]) {
        const g = TELEGRAM_EVENTS[k].group;
        groups.set(g, [...(groups.get(g) ?? []), k]);
    }

    return (
        <div className="max-w-3xl">
            <PageHeader title="تنبيهات تيليقرام" description="رسالة على قناة الفريق كل ما يصير إشي مهم." />

            <Card className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="flex items-center gap-3">
                        {ready ? <CheckCircle2 className="size-6 text-emerald-600" aria-hidden /> : <CircleAlert className="size-6 text-amber-600" aria-hidden />}
                        <div>
                            <p className="font-medium">{ready ? "البوت مربوط" : "البوت مش مربوط لسا"}</p>
                            <p className="text-sm text-muted-foreground">
                                {ready ? "التوكن ورقم القناة موجودين بملف .env." : "أضف TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID بملف .env وأعد تشغيل اللوحة."}
                            </p>
                        </div>
                    </div>
                    {ready && <TestButton />}
                </div>
            </Card>

            <form action={saveTelegramEventsAction}>
                <Card>
                    <CardHeader title="شو يوصلني؟" />
                    <div className="divide-y divide-line">
                        {[...groups].map(([group, keys]) => (
                            <div key={group} className="p-5">
                                <p className="mb-3 text-xs font-medium text-muted-foreground">{group}</p>
                                <div className="space-y-2">
                                    {keys.map((k) => (
                                        <label key={k} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 hover:bg-muted/50">
                                            <span className="flex items-center gap-3 text-sm">
                                                <span className="text-lg" aria-hidden>
                                                    {TELEGRAM_EVENTS[k].emoji}
                                                </span>
                                                {TELEGRAM_EVENTS[k].label}
                                            </span>
                                            <input type="checkbox" name={k} defaultChecked={events[k]} className="size-5 accent-[var(--color-primary)]" />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-line p-5">
                        <SubmitButton pendingText="جارٍ الحفظ…">حفظ</SubmitButton>
                    </div>
                </Card>
            </form>

            <p className="mt-4 text-xs leading-6 text-muted-foreground">
                الإيميلات بتطلع مخفية جزئياً (مثل za•••@gmail.com). التذكير قبل المحاضرة بينبعث مع الفحص الدوري كل ساعة، مرة وحدة لكل محاضرة.
            </p>
        </div>
    );
}
