"use client";

import { useState } from "react";

/** Shown once after creating a user or resetting a password. */
export function TempPassword({ email, password }: { email?: string; password: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">كلمة المرور المؤقتة (تظهر مرة واحدة)</p>
            {email && <p className="ltr mt-1 text-xs">{email}</p>}
            <div className="mt-2 flex items-center gap-2">
                <code className="ltr flex-1 rounded bg-white px-2 py-1.5 font-mono select-all">{password}</code>
                <button
                    type="button"
                    className="rounded border border-amber-300 bg-white px-2 py-1.5 text-xs"
                    onClick={() => navigator.clipboard?.writeText(password).then(() => setCopied(true))}
                >
                    {copied ? "تم النسخ" : "نسخ"}
                </button>
            </div>
            <p className="mt-2 text-xs">
                أرسلها للموظف بطريقة آمنة (وليس في نفس رسالة البريد). سيُطلب منه تغييرها وإعداد التحقق بخطوتين عند أول دخول.
            </p>
        </div>
    );
}
