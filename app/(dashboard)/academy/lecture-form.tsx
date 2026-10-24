"use client";

import { useActionState, useState } from "react";
import { ImagePlus, MapPin, Video } from "lucide-react";
import { createLectureAction, updateLectureAction } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

export type LectureValues = {
    id?: string;
    titleAr: string;
    titleEn: string;
    speaker: string;
    description: string;
    startsAt: string;
    durationHours: string;
    mode: "IN_PERSON" | "ONLINE";
    location: string;
    onlineUrl: string;
    capacity: string;
    registrationDeadline: string;
    status: "DRAFT" | "PUBLISHED" | "CLOSED";
    imageUrl?: string | null;
};

const area = "w-full rounded-lg border border-line bg-white p-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";

export function LectureForm({ initial }: { initial: LectureValues }) {
    const editing = !!initial.id;
    const [state, action] = useActionState(editing ? updateLectureAction : createLectureAction, undefined);
    const [mode, setMode] = useState(initial.mode);
    const [preview, setPreview] = useState<string | null>(initial.imageUrl ?? null);

    return (
        <form action={action} className="space-y-6">
            {initial.id && <input type="hidden" name="id" value={initial.id} />}
            {state?.error && <Alert>{state.error}</Alert>}

            <Card>
                <CardHeader title="المحاضرة" />
                <div className="grid gap-4 p-5 sm:grid-cols-[220px_1fr]">
                    <label className="group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-muted text-sm text-muted-foreground hover:border-primary">
                        {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                            <>
                                <ImagePlus className="mb-2 size-7" aria-hidden />
                                صورة المحاضرة
                                <span className="mt-1 text-xs">JPG أو PNG، حتى 5 ميجا</span>
                            </>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-center text-xs text-white opacity-0 group-hover:opacity-100">
                            {preview ? "تغيير الصورة" : "اختيار صورة"}
                        </span>
                        <input
                            type="file"
                            name="image"
                            accept=".jpg,.jpeg,.png,.webp"
                            className="sr-only"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setPreview(URL.createObjectURL(f));
                            }}
                        />
                    </label>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="titleAr">العنوان</Label>
                            <Input id="titleAr" name="titleAr" required maxLength={200} defaultValue={initial.titleAr} placeholder="كيف تطلق متجرك الإلكتروني في أسبوع" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label htmlFor="titleEn">
                                    العنوان بالإنجليزي <span className="font-normal text-muted-foreground">(اختياري)</span>
                                </Label>
                                <Input id="titleEn" name="titleEn" dir="ltr" maxLength={200} defaultValue={initial.titleEn} />
                            </div>
                            <div>
                                <Label htmlFor="speaker">المحاضر</Label>
                                <Input id="speaker" name="speaker" maxLength={160} defaultValue={initial.speaker} placeholder="م. ليلى سمير" />
                            </div>
                        </div>
                        {editing && initial.imageUrl && (
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input type="checkbox" name="removeImage" /> إزالة الصورة الحالية
                            </label>
                        )}
                    </div>
                    <div className="sm:col-span-2">
                        <Label htmlFor="description">
                            الوصف <span className="font-normal text-muted-foreground">(شو رح يتعلم الحاضر)</span>
                        </Label>
                        <textarea id="description" name="description" rows={4} maxLength={5000} defaultValue={initial.description} className={area} />
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader title="الموعد والمكان" />
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <div>
                        <Label htmlFor="startsAt">التاريخ والوقت (بتوقيت عمّان)</Label>
                        <Input id="startsAt" name="startsAt" type="datetime-local" required dir="ltr" defaultValue={initial.startsAt} />
                    </div>
                    <div>
                        <Label htmlFor="durationHours">المدة بالساعات</Label>
                        <Input id="durationHours" name="durationHours" type="number" min={0.25} max={24} step={0.25} required dir="ltr" defaultValue={initial.durationHours} />
                    </div>
                    <fieldset className="sm:col-span-2">
                        <legend className="mb-1.5 text-sm font-medium">النوع</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {[
                                { v: "IN_PERSON" as const, label: "حضوري", icon: MapPin },
                                { v: "ONLINE" as const, label: "أونلاين", icon: Video },
                            ].map(({ v, label, icon: Icon }) => (
                                <label
                                    key={v}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm",
                                        mode === v ? "border-primary bg-primary/5" : "border-line bg-white hover:bg-muted"
                                    )}
                                >
                                    <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="sr-only" />
                                    <Icon className={cn("size-4", mode === v ? "text-primary" : "text-muted-foreground")} aria-hidden />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    {mode === "IN_PERSON" ? (
                        <div className="sm:col-span-2">
                            <Label htmlFor="location">العنوان</Label>
                            <Input id="location" name="location" maxLength={300} defaultValue={initial.location} placeholder="عمّان، شارع المدينة المنورة، مبنى ..." />
                        </div>
                    ) : (
                        <div className="sm:col-span-2">
                            <Label htmlFor="onlineUrl">
                                رابط المحاضرة <span className="font-normal text-muted-foreground">(يظهر للمسجلين فقط بعد التسجيل)</span>
                            </Label>
                            <Input id="onlineUrl" name="onlineUrl" dir="ltr" maxLength={500} defaultValue={initial.onlineUrl} placeholder="https://meet.google.com/..." />
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <CardHeader title="التسجيل" />
                <div className="grid gap-4 p-5 sm:grid-cols-3">
                    <div>
                        <Label htmlFor="capacity">عدد المقاعد</Label>
                        <Input id="capacity" name="capacity" type="number" min={1} max={10000} required dir="ltr" defaultValue={initial.capacity} />
                    </div>
                    <div>
                        <Label htmlFor="registrationDeadline">
                            آخر موعد للتسجيل <span className="font-normal text-muted-foreground">(اختياري)</span>
                        </Label>
                        <Input id="registrationDeadline" name="registrationDeadline" type="datetime-local" dir="ltr" defaultValue={initial.registrationDeadline} />
                    </div>
                    <div>
                        <Label htmlFor="status">الحالة</Label>
                        <Select id="status" name="status" defaultValue={initial.status}>
                            <option value="DRAFT">مسودة (مخفية عن الموقع)</option>
                            <option value="PUBLISHED">منشورة</option>
                            <option value="CLOSED">منشورة ومكتملة (التسجيل مسكّر)</option>
                        </Select>
                    </div>
                </div>
            </Card>

            <SubmitButton pendingText="جارٍ الحفظ…">{editing ? "حفظ التعديلات" : "إضافة المحاضرة"}</SubmitButton>
        </form>
    );
}
