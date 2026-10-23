"use client";

import { useActionState, useState } from "react";
import type { CertificateType, Gender } from "@prisma/client";
import { issueCertificateAction, updateCertificateAction } from "./actions";
import { TypeFields, TypePicker } from "./type-fields";
import type { CertDetails } from "@/lib/certificates/types";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export type CertFormValues = {
    id?: string;
    type: CertificateType;
    nameAr: string;
    nameEn: string;
    gender: Gender;
    email: string;
    issuedAt: string;
    details: CertDetails;
};

export function CertForm({ initial }: { initial: CertFormValues }) {
    const editing = !!initial.id;
    const [state, action] = useActionState(editing ? updateCertificateAction : issueCertificateAction, undefined);
    const [type, setType] = useState<CertificateType>(initial.type);

    return (
        <form action={action} className="space-y-6">
            {initial.id && <input type="hidden" name="id" value={initial.id} />}
            {state?.error && <Alert>{state.error}</Alert>}

            <Card className="p-5">
                <TypePicker value={type} onChange={setType} />
            </Card>

            <Card>
                <CardHeader title="صاحب الشهادة" />
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <div>
                        <Label htmlFor="nameEn">الاسم بالإنجليزي (يظهر كبيراً)</Label>
                        <Input id="nameEn" name="nameEn" defaultValue={initial.nameEn} required dir="ltr" maxLength={160} placeholder="Sara Mohammad Al-Ali" />
                    </div>
                    <div>
                        <Label htmlFor="nameAr">الاسم بالعربي</Label>
                        <Input id="nameAr" name="nameAr" defaultValue={initial.nameAr} required maxLength={160} placeholder="سارة محمد العلي" />
                    </div>
                    <div>
                        <Label htmlFor="gender">الجنس (لصياغة الجملة العربية)</Label>
                        <Select id="gender" name="gender" defaultValue={initial.gender}>
                            <option value="MALE">ذكر</option>
                            <option value="FEMALE">أنثى</option>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="email">
                            الإيميل <span className="font-normal text-muted-foreground">(اختياري، للإرسال لاحقاً)</span>
                        </Label>
                        <Input id="email" name="email" type="email" defaultValue={initial.email} dir="ltr" maxLength={191} />
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader title="تفاصيل الشهادة" />
                <div className="space-y-4 p-5">
                    <TypeFields type={type} d={type === initial.type ? initial.details : {}} />
                    <div className="max-w-xs">
                        <Label htmlFor="issuedAt">تاريخ الإصدار</Label>
                        <Input id="issuedAt" name="issuedAt" type="date" defaultValue={initial.issuedAt} required dir="ltr" />
                    </div>
                </div>
            </Card>

            <SubmitButton pendingText="جارٍ الحفظ…">{editing ? "حفظ التعديلات" : "إصدار الشهادة"}</SubmitButton>
        </form>
    );
}
