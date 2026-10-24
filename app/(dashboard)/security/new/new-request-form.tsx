"use client";

import { useActionState } from "react";
import { createRequestAction } from "../actions";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function NewRequestForm({ staff, today }: { staff: { id: string; name: string }[]; today: string }) {
    const [state, action] = useActionState(createRequestAction, undefined);
    return (
        <form action={action} className="space-y-6">
            {state?.error && <Alert>{state.error}</Alert>}
            <Card>
                <CardHeader title="الموقع والعميل" />
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <Label htmlFor="target">رابط الموقع</Label>
                        <Input id="target" name="target" required dir="ltr" maxLength={500} placeholder="https://store.example.com" />
                    </div>
                    <div>
                        <Label htmlFor="type">نوع الفحص</Label>
                        <Select id="type" name="type" defaultValue="SITE">
                            <option value="SITE">فحص موقع</option>
                            <option value="LEAK">فحص تسريبات</option>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="name">العميل أو الجهة</Label>
                        <Input id="name" name="name" required maxLength={120} placeholder="متجر الأناقة" />
                    </div>
                    <div>
                        <Label htmlFor="email">إيميل العميل</Label>
                        <Input id="email" name="email" type="email" required dir="ltr" maxLength={191} />
                    </div>
                    <div>
                        <Label htmlFor="phone">
                            الهاتف <span className="font-normal text-muted-foreground">(اختياري)</span>
                        </Label>
                        <Input id="phone" name="phone" dir="ltr" maxLength={40} placeholder="+962 7X XXX XXXX" />
                    </div>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input type="checkbox" name="authorized" defaultChecked />
                        العميل أكّد ملكيته للموقع أو فوّضنا بفحصه
                    </label>
                </div>
            </Card>

            <Card>
                <CardHeader title="الإسناد" description="الموظف يرى الطلب في قائمته فوراً." />
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <div>
                        <Label htmlFor="assigneeId">الموظف المسؤول</Label>
                        <Select id="assigneeId" name="assigneeId" defaultValue="">
                            <option value="">لاحقاً</option>
                            {staff.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="dueAt">
                            موعد التسليم <span className="font-normal text-muted-foreground">(اختياري)</span>
                        </Label>
                        <Input id="dueAt" name="dueAt" type="date" min={today} dir="ltr" />
                    </div>
                    <div className="sm:col-span-2">
                        <Label htmlFor="note">
                            تعليمات للموظف <span className="font-normal text-muted-foreground">(اختياري، تُحفظ كأول ملاحظة)</span>
                        </Label>
                        <textarea
                            id="note"
                            name="note"
                            rows={3}
                            maxLength={5000}
                            placeholder="مثلاً: ركّز على صفحة الدفع ولوحة الإدارة."
                            className="w-full rounded-lg border border-line bg-white p-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        />
                    </div>
                </div>
            </Card>

            <SubmitButton pendingText="جارٍ الإنشاء…">إنشاء الطلب</SubmitButton>
        </form>
    );
}
