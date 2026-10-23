"use client";

import { useActionState, useState } from "react";
import type { CertificateType } from "@prisma/client";
import { Download } from "lucide-react";
import { issueBulkAction, previewBulkAction } from "../actions";
import { TypeFields, TypePicker } from "../type-fields";
import { TYPE_LABELS } from "@/lib/certificates/types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function BulkForm({ today }: { today: string }) {
    const [previewState, preview] = useActionState(previewBulkAction, undefined);
    const [issueState, issue] = useActionState(issueBulkAction, undefined);
    const [type, setType] = useState<CertificateType>("ATTENDANCE");
    const [editing, setEditing] = useState(true);

    const p = previewState?.preview;
    const showPreview = p && !editing;

    if (showPreview) {
        const valid = p.rows.filter((r) => !r.error);
        const invalid = p.rows.length - valid.length;
        return (
            <div className="space-y-6">
                {issueState?.error && <Alert>{issueState.error}</Alert>}
                <Alert tone={invalid ? "info" : "success"}>
                    {valid.length} شهادة {TYPE_LABELS[p.type]} جاهزة للإصدار
                    {invalid ? `، و${invalid} صف فيه أخطاء ولن يُصدر (صحّحه في الملف وارفعه مرة ثانية إذا بدك).` : "."}
                </Alert>
                <Card className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-sm">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-start font-medium">السطر</th>
                                <th className="px-4 py-3 text-start font-medium">الاسم بالإنجليزي</th>
                                <th className="px-4 py-3 text-start font-medium">الاسم بالعربي</th>
                                <th className="px-4 py-3 text-start font-medium">الجنس</th>
                                <th className="px-4 py-3 text-start font-medium">الإيميل</th>
                                <th className="px-4 py-3 text-start font-medium">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {p.rows.map((r) => (
                                <tr key={r.line} className={r.error ? "bg-red-50/60" : ""}>
                                    <td className="px-4 py-2.5 text-muted-foreground">{r.line}</td>
                                    <td className="ltr px-4 py-2.5 text-start">{r.nameEn || "—"}</td>
                                    <td className="px-4 py-2.5">{r.nameAr || "—"}</td>
                                    <td className="px-4 py-2.5">{r.gender || "ذكر"}</td>
                                    <td className="ltr px-4 py-2.5 text-start text-xs">{r.email || "—"}</td>
                                    <td className="px-4 py-2.5">{r.error ? <span className="text-xs text-red-700">{r.error}</span> : <Badge tone="success">جاهز</Badge>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
                <form action={issue} className="flex flex-wrap gap-2">
                    {Object.entries(p.fields).map(([k, v]) => (
                        <input key={k} type="hidden" name={k} value={v} />
                    ))}
                    <input
                        type="hidden"
                        name="people"
                        value={JSON.stringify(valid.map(({ nameAr, nameEn, gender, email }) => ({ nameAr, nameEn, gender, email })))}
                    />
                    <SubmitButton disabled={!valid.length} pendingText="جارٍ الإصدار…">
                        إصدار {valid.length} شهادة
                    </SubmitButton>
                    <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
                        رجوع وتعديل
                    </Button>
                </form>
            </div>
        );
    }

    return (
        <form action={(fd) => { setEditing(false); return preview(fd); }} className="space-y-6">
            {previewState?.error && <Alert>{previewState.error}</Alert>}

            <Card className="p-5">
                <TypePicker value={type} onChange={setType} />
            </Card>

            <Card>
                <CardHeader title="التفاصيل المشتركة" description="نفس القيم لكل الأشخاص في الملف." />
                <div className="space-y-4 p-5">
                    <TypeFields type={type} d={p && p.type === type ? p.details : {}} />
                    <div className="max-w-xs">
                        <Label htmlFor="issuedAt">تاريخ الإصدار</Label>
                        <Input id="issuedAt" name="issuedAt" type="date" defaultValue={p?.issuedAt || today} required dir="ltr" />
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="ملف الأسماء"
                    description="CSV فيه الأعمدة: name_ar، name_en، gender (ذكر/أنثى)، email. من Excel: حفظ باسم ← CSV UTF-8."
                    action={
                        <a href="/certificates/sample-csv" className={buttonClass("secondary", "sm")}>
                            <Download className="size-4" aria-hidden />
                            تحميل النموذج
                        </a>
                    }
                />
                <div className="p-5">
                    <input
                        type="file"
                        name="file"
                        accept=".csv,text/csv"
                        required
                        aria-label="ملف CSV"
                        className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-primary"
                    />
                </div>
            </Card>

            <SubmitButton pendingText="جارٍ قراءة الملف…">مراجعة قبل الإصدار</SubmitButton>
        </form>
    );
}
