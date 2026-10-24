"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Finding } from "@prisma/client";
import { saveFindingAction } from "../actions";
import { SEVERITY, SEVERITY_ORDER } from "@/lib/requests";
import { Alert } from "@/components/ui/alert";
import { Input, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

const area = "w-full rounded-lg border border-line bg-white p-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";

export function FindingForm({ requestId, finding }: { requestId: number; finding?: Finding }) {
    const [state, action] = useActionState(saveFindingAction, undefined);
    const ref = useRef<HTMLFormElement>(null);
    useEffect(() => {
        if (state?.ok && !finding) ref.current?.reset();
    }, [state, finding]);

    return (
        <form ref={ref} action={action} className="space-y-3">
            <input type="hidden" name="requestId" value={requestId} />
            {finding && <input type="hidden" name="findingId" value={finding.id} />}
            {state?.error && <Alert>{state.error}</Alert>}
            {state?.ok && <Alert tone="success">{state.ok}</Alert>}
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <div>
                    <Label>عنوان الثغرة</Label>
                    <Input name="title" required maxLength={200} defaultValue={finding?.title} placeholder="مثلاً: لوحة الإدارة مكشوفة بدون حماية" />
                </div>
                <div>
                    <Label>الخطورة</Label>
                    <Select name="severity" defaultValue={finding?.severity ?? "MEDIUM"}>
                        {SEVERITY_ORDER.map((s) => (
                            <option key={s} value={s}>
                                {SEVERITY[s].ar}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>
            <div>
                <Label>
                    المكان المتأثر <span className="font-normal text-muted-foreground">(رابط، صفحة، أو مكوّن، اختياري)</span>
                </Label>
                <Input name="affected" maxLength={500} dir="ltr" defaultValue={finding?.affected ?? ""} placeholder="https://example.com/admin" />
            </div>
            <div>
                <Label>الوصف</Label>
                <textarea name="description" required rows={4} maxLength={20000} defaultValue={finding?.description} className={area} placeholder="ما المشكلة، ولماذا هي خطيرة على المتجر؟" />
            </div>
            <div>
                <Label>
                    خطوات إعادة الإنتاج <span className="font-normal text-muted-foreground">(اختياري)</span>
                </Label>
                <textarea name="steps" rows={3} maxLength={20000} defaultValue={finding?.steps ?? ""} className={area} dir="auto" />
            </div>
            <div>
                <Label>
                    التوصية <span className="font-normal text-muted-foreground">(كيف تُصلح، اختياري)</span>
                </Label>
                <textarea name="recommendation" rows={3} maxLength={20000} defaultValue={finding?.recommendation ?? ""} className={area} />
            </div>
            <SubmitButton size="sm" pendingText="جارٍ الحفظ…">
                {finding ? "حفظ التعديل" : "إضافة الثغرة"}
            </SubmitButton>
        </form>
    );
}
