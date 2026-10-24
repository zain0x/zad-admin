import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, GraduationCap, ImageIcon, MapPin, Plus, Users, Video } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { LECTURE_STATE_LABELS, lectureState, lectureWhen, type LectureState } from "@/lib/academy";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "المحاضرات" };

const STATE_TONE: Record<LectureState, "success" | "warning" | "danger" | "neutral" | "primary"> = {
    open: "success",
    full: "danger",
    deadline: "warning",
    closed: "danger",
    past: "neutral",
    draft: "neutral",
};

type Props = { searchParams: Promise<{ show?: string; deleted?: string }> };

export default async function LecturesPage({ searchParams }: Props) {
    await requireSection("lectures");
    const sp = await searchParams;
    const show = sp.show === "past" ? "past" : "upcoming";
    const now = new Date();

    const [lectures, counts, totals] = await Promise.all([
        db.lecture.findMany({
            where: show === "past" ? { startsAt: { lt: now } } : { startsAt: { gte: now } },
            orderBy: { startsAt: show === "past" ? "desc" : "asc" },
            take: 100,
        }),
        db.lectureRegistration.groupBy({ by: ["lectureId"], where: { status: "CONFIRMED" }, _count: true }),
        Promise.all([
            db.lecture.count({ where: { startsAt: { gte: now }, status: { not: "DRAFT" } } }),
            db.lectureRegistration.count({ where: { status: "CONFIRMED", lecture: { startsAt: { gte: now } } } }),
            db.lectureRegistration.count({ where: { status: "CONFIRMED" } }),
        ]),
    ]);
    const confirmed = new Map(counts.map((c) => [c.lectureId, c._count]));

    return (
        <>
            <PageHeader
                title="المحاضرات"
                description="أضف محاضرات أكاديمية زاد، وتابع المسجلين والمقاعد المتبقية."
                action={
                    <Link href="/academy/new" className={buttonClass("primary")}>
                        <Plus className="size-4" aria-hidden />
                        محاضرة جديدة
                    </Link>
                }
            />

            {sp.deleted && (
                <div className="mb-4">
                    <Alert tone="success">تم حذف المحاضرة.</Alert>
                </div>
            )}

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
                {[
                    { label: "محاضرات قادمة منشورة", value: totals[0], icon: CalendarDays },
                    { label: "مسجلين في القادمة", value: totals[1], icon: Users },
                    { label: "كل التسجيلات", value: totals[2], icon: GraduationCap },
                ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4">
                        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                            <s.icon className="size-5" aria-hidden />
                        </span>
                        <div>
                            <p className="text-2xl font-bold">{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1 text-sm w-fit">
                {[
                    { v: "upcoming", label: "القادمة" },
                    { v: "past", label: "السابقة" },
                ].map((t) => (
                    <Link
                        key={t.v}
                        href={t.v === "past" ? "/academy?show=past" : "/academy"}
                        className={cn("rounded-md px-4 py-1.5", show === t.v ? "bg-white font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        {t.label}
                    </Link>
                ))}
            </div>

            {lectures.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-white p-12 text-center">
                    <GraduationCap className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden />
                    <p className="font-medium">{show === "past" ? "ما في محاضرات سابقة." : "ما في محاضرات قادمة."}</p>
                    {show === "upcoming" && (
                        <Link href="/academy/new" className={cn(buttonClass("primary"), "mt-4")}>
                            أضف أول محاضرة
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {lectures.map((l) => {
                        const n = confirmed.get(l.id) ?? 0;
                        const state = lectureState(l, n, now);
                        const when = lectureWhen(l.startsAt);
                        const pct = Math.min(100, Math.round((n / l.capacity) * 100));
                        return (
                            <Link key={l.id} href={`/academy/${l.id}`} className="group overflow-hidden rounded-xl border border-line bg-white transition hover:border-primary/40 hover:shadow-md">
                                <div className="relative aspect-[16/9] bg-gradient-to-br from-primary/15 to-primary/5">
                                    {l.imageKey ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={`/academy/${l.id}/image?v=${l.updatedAt.getTime()}`} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <ImageIcon className="absolute inset-0 m-auto size-8 text-primary/40" aria-hidden />
                                    )}
                                    <span className="absolute top-3 start-3">
                                        <Badge tone={STATE_TONE[state]}>{LECTURE_STATE_LABELS[state]}</Badge>
                                    </span>
                                </div>
                                <div className="space-y-3 p-4">
                                    <h2 className="line-clamp-2 font-semibold group-hover:text-primary">{l.titleAr}</h2>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        <p className="flex items-center gap-1.5">
                                            <CalendarDays className="size-3.5" aria-hidden />
                                            {when.date}
                                        </p>
                                        <p className="flex items-center gap-1.5">
                                            <Clock className="size-3.5" aria-hidden />
                                            {when.time}
                                            <span className="mx-1">·</span>
                                            {l.mode === "ONLINE" ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                                            {l.mode === "ONLINE" ? "أونلاين" : "حضوري"}
                                        </p>
                                    </div>
                                    <div>
                                        <div className="mb-1 flex justify-between text-xs">
                                            <span className="text-muted-foreground">المقاعد</span>
                                            <span className="font-medium">
                                                {n} / {l.capacity}
                                            </span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </>
    );
}
