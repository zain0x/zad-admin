"use client";

import { useActionState } from "react";
import { closeRequestAction } from "../actions";
import { Alert } from "@/components/ui/alert";
import { Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function CloseForm({ requestId, findings }: { requestId: number; findings: number }) {
    const [state, action] = useActionState(closeRequestAction, undefined);
    return (
        <form
            action={action}
            onSubmit={(e) => {
                if (!window.confirm("إقفال الملف؟ لن يمكن تعديل الثغرات والملفات والملاحظات بعدها إلا إذا أعاد المدير فتحه.")) e.preventDefault();
            }}
            className="space-y-3"
        >
            <input type="hidden" name="requestId" value={requestId} />
            {state?.error && <Alert>{state.error}</Alert>}
            <div>
                <Label htmlFor="summary">الملخص النهائي</Label>
                <textarea
                    id="summary"
                    name="summary"
                    required
                    minLength={10}
                    rows={5}
                    maxLength={20000}
                    placeholder={`ماذا تم فحصه، وأهم النتائج (${findings} ثغرة مسجلة)، والخطوة القادمة مع العميل.`}
                    className="w-full rounded-lg border border-line bg-white p-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <p className="mt-1 text-xs text-muted-foreground">يظهر في أول صفحة من التقرير.</p>
            </div>
            <div>
                <Label htmlFor="outcome">النتيجة</Label>
                <Select id="outcome" name="outcome" defaultValue="REPORT_SENT">
                    <option value="REPORT_SENT">تم تسليم التقرير</option>
                    <option value="CONVERTED">تحوّل لعميل زاد</option>
                    <option value="CLOSED">أُغلق بدون فحص</option>
                </Select>
            </div>
            <SubmitButton variant="primary" className="w-full" pendingText="جارٍ الإقفال…">
                إقفال الملف
            </SubmitButton>
        </form>
    );
}
