"use client";

import { useActionState, useEffect, useRef } from "react";
import { addNoteAction, issueInternCertificateAction, updateDetailsAction } from "../actions";
import { Alert } from "@/components/ui/alert";
import { Input, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

const area = "w-full rounded-lg border border-line bg-white p-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";

export function DetailsForm({
    id,
    staff,
    initial,
}: {
    id: number;
    staff: { id: string; name: string }[];
    initial: { nameEn: string; gender: "MALE" | "FEMALE"; supervisorId: string; department: string; startDate: string; endDate: string; hours: string };
}) {
    const [state, action] = useActionState(updateDetailsAction, undefined);
    return (
        <form action={action} className="space-y-3 p-5">
            <input type="hidden" name="applicationId" value={id} />
            {state?.error && <Alert>{state.error}</Alert>}
            {state?.ok && <Alert tone="success">{state.ok}</Alert>}
            <div>
                <Label htmlFor="nameEn">الاسم بالإنجليزي (يظهر على الشهادة)</Label>
                <Input id="nameEn" name="nameEn" dir="ltr" maxLength={160} defaultValue={initial.nameEn} placeholder="Ahmad Ali" />
            </div>
            <div>
                <Label htmlFor="gender">الجنس</Label>
                <Select id="gender" name="gender" defaultValue={initial.gender}>
                    <option value="MALE">ذكر</option>
                    <option value="FEMALE">أنثى</option>
                </Select>
            </div>
            <div>
                <Label htmlFor="supervisorId">المشرف</Label>
                <Select id="supervisorId" name="supervisorId" defaultValue={initial.supervisorId}>
                    <option value="">بدون مشرف</option>
                    {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </Select>
            </div>
            <div>
                <Label htmlFor="department">القسم (يظهر على الشهادة)</Label>
                <Input id="department" name="department" maxLength={120} defaultValue={initial.department} placeholder="الأمن السيبراني" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label htmlFor="startDate">البداية</Label>
                    <Input id="startDate" name="startDate" type="date" dir="ltr" defaultValue={initial.startDate} />
                </div>
                <div>
                    <Label htmlFor="endDate">النهاية</Label>
                    <Input id="endDate" name="endDate" type="date" dir="ltr" defaultValue={initial.endDate} />
                </div>
            </div>
            <SubmitButton size="sm" pendingText="جارٍ الحفظ…">
                حفظ
            </SubmitButton>
        </form>
    );
}

export function NoteForm({ id }: { id: number }) {
    const ref = useRef<HTMLFormElement>(null);
    const [state, action] = useActionState(addNoteAction, undefined);
    useEffect(() => {
        if (state?.ok) ref.current?.reset();
    }, [state]);
    return (
        <form ref={ref} action={action} className="space-y-2">
            <input type="hidden" name="applicationId" value={id} />
            {state?.error && <Alert>{state.error}</Alert>}
            <textarea name="body" required maxLength={5000} rows={3} aria-label="ملاحظة جديدة" placeholder="ملاحظة داخلية: نتيجة المقابلة، تقييم، الخطوة القادمة…" className={area} />
            <SubmitButton size="sm" pendingText="جارٍ الحفظ…">
                إضافة ملاحظة
            </SubmitButton>
        </form>
    );
}

export function IssueCertForm({ id }: { id: number }) {
    const [state, action] = useActionState(issueInternCertificateAction, undefined);
    return (
        <form action={action} className="space-y-3">
            <input type="hidden" name="applicationId" value={id} />
            {state?.error && <Alert>{state.error}</Alert>}
            <div>
                <Label htmlFor="skills">
                    المهارات <span className="font-normal text-muted-foreground">(اختياري، افصل بفاصلة)</span>
                </Label>
                <Input id="skills" name="skills" maxLength={600} placeholder="اختبار الاختراق، تحليل الثغرات" />
            </div>
            <SubmitButton size="sm" pendingText="جارٍ الإصدار…">
                إصدار شهادة تدريب
            </SubmitButton>
        </form>
    );
}
