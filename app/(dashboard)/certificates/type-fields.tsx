"use client";

import type { CertificateType } from "@prisma/client";
import { Award, GraduationCap, Presentation } from "lucide-react";
import type { CertDetails } from "@/lib/certificates/types";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const TYPES: { value: CertificateType; label: string; hint: string; icon: React.ElementType }[] = [
    { value: "INTERNSHIP", label: "تدريب", hint: "طالب أو متدرب أنهى فترة تدريب", icon: GraduationCap },
    { value: "ATTENDANCE", label: "حضور", hint: "حضر محاضرة أو ورشة", icon: Presentation },
    { value: "COURSE", label: "كورس", hint: "أتمّ كورساً تعليمياً", icon: Award },
];

export function TypePicker({ value, onChange }: { value: CertificateType; onChange: (t: CertificateType) => void }) {
    return (
        <fieldset>
            <legend className="mb-1.5 text-sm font-medium">نوع الشهادة</legend>
            <div className="grid gap-2 sm:grid-cols-3">
                {TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = value === t.value;
                    return (
                        <label
                            key={t.value}
                            className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                                active ? "border-primary bg-primary/5" : "border-line bg-white hover:bg-muted"
                            )}
                        >
                            <input type="radio" name="type" value={t.value} checked={active} onChange={() => onChange(t.value)} className="sr-only" />
                            <Icon className={cn("mt-0.5 size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                            <span>
                                <span className="block font-medium">{t.label}</span>
                                <span className="text-xs text-muted-foreground">{t.hint}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <Label>
                {label} {hint && <span className="font-normal text-muted-foreground">({hint})</span>}
            </Label>
            {children}
        </div>
    );
}

/** The fields that depend on the certificate type. Shared by single and bulk issue. */
export function TypeFields({ type, d = {} }: { type: CertificateType; d?: CertDetails }) {
    if (type === "INTERNSHIP") {
        return (
            <div className="grid gap-4 sm:grid-cols-2" key="internship">
                <Field label="القسم">
                    <Input name="departmentAr" defaultValue={d.departmentAr} required maxLength={120} placeholder="الأمن السيبراني" />
                </Field>
                <Field label="القسم بالإنجليزي" hint="اختياري">
                    <Input name="departmentEn" defaultValue={d.departmentEn} dir="ltr" maxLength={120} placeholder="Cybersecurity" />
                </Field>
                <Field label="بداية التدريب">
                    <Input name="startDate" type="date" defaultValue={d.startDate} required dir="ltr" />
                </Field>
                <Field label="نهاية التدريب">
                    <Input name="endDate" type="date" defaultValue={d.endDate} required dir="ltr" />
                </Field>
                <Field label="المهارات" hint="اختياري، افصل بينها بفاصلة، حتى 6">
                    <Input name="skills" defaultValue={d.skills?.join("، ")} maxLength={600} placeholder="اختبار الاختراق، تحليل الثغرات" />
                </Field>
            </div>
        );
    }
    const course = type === "COURSE";
    return (
        <div className="grid gap-4 sm:grid-cols-2" key={type}>
            <Field label={course ? "اسم الكورس" : "عنوان المحاضرة"}>
                <Input name="titleAr" defaultValue={d.titleAr} required maxLength={160} placeholder={course ? "أساسيات الأمن السيبراني" : "حماية المتجر من الاحتيال"} />
            </Field>
            <Field label={course ? "اسم الكورس بالإنجليزي" : "العنوان بالإنجليزي"} hint="اختياري">
                <Input name="titleEn" defaultValue={d.titleEn} dir="ltr" maxLength={160} />
            </Field>
            <Field label={course ? "تاريخ الإتمام" : "تاريخ المحاضرة"}>
                <Input name="date" type="date" defaultValue={d.date} required dir="ltr" />
            </Field>
            {!course && (
                <Field label="المدة بالساعات">
                    <Input name="hours" type="number" min={1} max={5000} defaultValue={d.hours} required dir="ltr" />
                </Field>
            )}
        </div>
    );
}
