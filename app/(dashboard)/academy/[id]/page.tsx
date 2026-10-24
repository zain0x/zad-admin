import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Check, Clock, Download, ExternalLink, Lock, LockOpen, MapPin, Pencil, Trash2, Users, Video } from "lucide-react";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth/permissions";
import { LECTURE_STATE_LABELS, academyPublicUrl, durationLabel, lectureState, lectureWhen, toAmmanLocal } from "@/lib/academy";
import { cn, formatDateTime } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/app/(dashboard)/security/[id]/confirm-button";
import { cancelRegistrationAction, deleteLectureAction, toggleAttendedAction, toggleLectureFullAction } from "../actions";
import { LectureForm } from "../lecture-form";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const l = await db.lecture.findUnique({ where: { id: (await params).id }, select: { titleAr: true } });
    return { title: l?.titleAr ?? "محاضرة" };
}

export default async function LecturePage({ params, searchParams }: Props) {
    await requireSection("lectures");
    const id = (await params).id;
    const sp = await searchParams;
    const l = await db.lecture.findUnique({ where: { id }, include: { registrations: { orderBy: { createdAt: "desc" } }, createdBy: { select: { name: true } } } });
    if (!l) notFound();

    const active = l.registrations.filter((r) => r.status === "CONFIRMED");
    const cancelled = l.registrations.length - active.length;
    const attended = active.filter((r) => r.attended).length;
    const state = lectureState(l, active.length);
    const when = lectureWhen(l.startsAt);
    const left = Math.max(0, l.capacity - active.length);
    const pct = Math.min(100, Math.round((active.length / l.capacity) * 100));
    const tab = sp.tab === "edit" ? "edit" : "people";
    const imageUrl = l.imageKey ? `/academy/${l.id}/image?v=${l.updatedAt.getTime()}` : null;

    return (
        <>
            <Link href="/academy" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                المحاضرات
            </Link>

            {sp.created && (
                <div className="mb-4">
                    <Alert tone="success">تمت إضافة المحاضرة{l.status === "PUBLISHED" ? " وهي ظاهرة الآن على صفحة الأكاديمية." : ". حالتها مسودة، انشرها لما تجهز."}</Alert>
                </div>
            )}
            {sp.saved && (
                <div className="mb-4">
                    <Alert tone="success">تم حفظ التعديلات.</Alert>
                </div>
            )}

            {/* Header */}
            <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-white">
                <div className="grid md:grid-cols-[320px_1fr]">
                    <div className="relative aspect-[16/10] bg-gradient-to-br from-primary/20 to-primary/5 md:aspect-auto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    </div>
                    <div className="space-y-4 p-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={state === "open" ? "success" : state === "full" ? "danger" : "neutral"}>{LECTURE_STATE_LABELS[state]}</Badge>
                            <span className="text-xs text-muted-foreground">{l.mode === "ONLINE" ? "أونلاين" : "حضوري"}</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{l.titleAr}</h1>
                            {l.titleEn && <p className="ltr mt-1 text-start text-sm text-muted-foreground">{l.titleEn}</p>}
                            {l.speaker && <p className="mt-2 text-sm">المحاضر: {l.speaker}</p>}
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                            <p className="flex items-center gap-2">
                                <CalendarDays className="size-4 text-primary" aria-hidden />
                                {when.date}
                            </p>
                            <p className="flex items-center gap-2">
                                <Clock className="size-4 text-primary" aria-hidden />
                                {when.time} · {durationLabel(l.durationMinutes)}
                            </p>
                            <p className="flex items-center gap-2 sm:col-span-2">
                                {l.mode === "ONLINE" ? <Video className="size-4 text-primary" aria-hidden /> : <MapPin className="size-4 text-primary" aria-hidden />}
                                <span className={l.mode === "ONLINE" ? "ltr break-all" : ""}>{(l.mode === "ONLINE" ? l.onlineUrl : l.location) || "—"}</span>
                            </p>
                            {l.registrationDeadline && <p className="sm:col-span-2">آخر موعد للتسجيل: {formatDateTime(l.registrationDeadline)}</p>}
                        </div>
                        <div>
                            <div className="mb-1.5 flex justify-between text-sm">
                                <span>
                                    <strong>{active.length}</strong> مسجّل من {l.capacity}
                                </span>
                                <span className="text-muted-foreground">{left ? `باقي ${left} مقعد` : "اكتمل العدد"}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div className={cn("h-full rounded-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link href={`/academy/${l.id}?tab=edit`} className={buttonClass("primary", "sm")}>
                                <Pencil className="size-4" aria-hidden />
                                تعديل المحاضرة والصورة
                            </Link>
                            {l.status !== "DRAFT" && (
                                <form action={toggleLectureFullAction}>
                                    <input type="hidden" name="id" value={l.id} />
                                    <button type="submit" className={buttonClass("secondary", "sm")}>
                                        {l.status === "CLOSED" ? (
                                            <>
                                                <LockOpen className="size-4" aria-hidden />
                                                فتح التسجيل
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="size-4" aria-hidden />
                                                تحديد كمكتملة
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                            <a href={`/academy/${l.id}/export`} className={buttonClass("secondary", "sm")}>
                                <Download className="size-4" aria-hidden />
                                تصدير المسجلين CSV
                            </a>
                            {l.status !== "DRAFT" && (
                                <a href={academyPublicUrl(l.id)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                                    <ExternalLink className="size-4" aria-hidden />
                                    عرض على الموقع
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-4 flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
                {[
                    { v: "people", label: `المسجلون (${active.length})` },
                    { v: "edit", label: "تعديل المحاضرة" },
                ].map((t) => (
                    <Link
                        key={t.v}
                        href={t.v === "edit" ? `/academy/${l.id}?tab=edit` : `/academy/${l.id}`}
                        className={cn("rounded-md px-4 py-1.5", tab === t.v ? "bg-white font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        {t.label}
                    </Link>
                ))}
            </div>

            {tab === "edit" ? (
                <div className="max-w-3xl">
                    <LectureForm
                        initial={{
                            id: l.id,
                            titleAr: l.titleAr,
                            titleEn: l.titleEn ?? "",
                            speaker: l.speaker ?? "",
                            description: l.description ?? "",
                            startsAt: toAmmanLocal(l.startsAt),
                            durationHours: String(l.durationMinutes / 60),
                            mode: l.mode,
                            location: l.location ?? "",
                            onlineUrl: l.onlineUrl ?? "",
                            capacity: String(l.capacity),
                            registrationDeadline: toAmmanLocal(l.registrationDeadline),
                            status: l.status,
                            imageUrl,
                        }}
                    />
                    <p className="mt-4 text-xs text-muted-foreground">
                        أضافها {l.createdBy?.name ?? "—"} في {formatDateTime(l.createdAt)}
                    </p>
                    <div className="mt-8 rounded-xl border border-red-200 bg-red-50/50 p-5">
                        <p className="font-medium text-red-700">حذف المحاضرة</p>
                        <p className="mt-1 text-sm text-red-700/80">بتنحذف المحاضرة وصورتها وكل التسجيلات ({l.registrations.length}) نهائياً. إذا بدك تخفيها بس، خلي حالتها «مسودة».</p>
                        <form action={deleteLectureAction} className="mt-3">
                            <input type="hidden" name="id" value={l.id} />
                            <ConfirmButton message={`حذف «${l.titleAr}» نهائياً مع ${l.registrations.length} تسجيل؟`} className={buttonClass("danger", "sm")}>
                                <Trash2 className="size-4" aria-hidden />
                                حذف نهائي
                            </ConfirmButton>
                        </form>
                    </div>
                </div>
            ) : (
                <Card>
                    <CardHeader
                        title="المسجلون"
                        description={`${active.length} مؤكد${cancelled ? ` · ${cancelled} ملغي` : ""}${attended ? ` · ${attended} حضر` : ""}`}
                    />
                    {l.registrations.length === 0 ? (
                        <div className="p-10 text-center text-sm text-muted-foreground">
                            <Users className="mx-auto mb-2 size-8" aria-hidden />
                            ما في تسجيلات لسا.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-xs text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-2.5 text-start font-medium">الاسم</th>
                                        <th className="px-4 py-2.5 text-start font-medium">التواصل</th>
                                        <th className="px-4 py-2.5 text-start font-medium">الرمز</th>
                                        <th className="px-4 py-2.5 text-start font-medium">سجّل في</th>
                                        <th className="px-4 py-2.5 text-start font-medium">حضر</th>
                                        <th className="px-4 py-2.5" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {l.registrations.map((r) => {
                                        const off = r.status === "CANCELLED";
                                        return (
                                            <tr key={r.id} className={off ? "opacity-50" : ""}>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium">{r.nameAr}</p>
                                                    <p className="ltr text-start text-xs text-muted-foreground">{r.nameEn}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="ltr text-start">{r.email}</p>
                                                    <p className="ltr text-start text-xs text-muted-foreground">{r.phone}</p>
                                                </td>
                                                <td className="ltr px-4 py-3 text-start font-mono text-xs">{r.code}</td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                                                <td className="px-4 py-3">
                                                    {off ? (
                                                        <Badge tone="danger">ملغي</Badge>
                                                    ) : (
                                                        <form action={toggleAttendedAction}>
                                                            <input type="hidden" name="registrationId" value={r.id} />
                                                            <button
                                                                type="submit"
                                                                aria-label={r.attended ? "إلغاء الحضور" : "تسجيل حضور"}
                                                                className={cn(
                                                                    "grid size-7 place-items-center rounded-md border",
                                                                    r.attended ? "border-emerald-500 bg-emerald-500 text-white" : "border-line bg-white text-transparent hover:text-muted-foreground"
                                                                )}
                                                            >
                                                                <Check className="size-4" aria-hidden />
                                                            </button>
                                                        </form>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-end">
                                                    {!off && (
                                                        <form action={cancelRegistrationAction}>
                                                            <input type="hidden" name="registrationId" value={r.id} />
                                                            <ConfirmButton message={`إلغاء تسجيل ${r.nameAr}؟ رح يرجع المقعد متاح.`} className="text-xs text-red-600 hover:underline">
                                                                إلغاء
                                                            </ConfirmButton>
                                                        </form>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}
        </>
    );
}
