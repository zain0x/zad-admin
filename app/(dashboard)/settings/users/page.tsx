import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { AddUserForm } from "./add-user-form";
import { UserActions } from "./user-actions";
import { PermsForm } from "./perms-form";

export const metadata: Metadata = { title: "الموظفون" };

export default async function UsersPage() {
    const { user: me } = await requireAdmin();
    const users = await db.user.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
    const now = new Date();

    return (
        <>
            <PageHeader title="الموظفون" description="لا يوجد تسجيل مفتوح: كل حساب يضيفه مدير، ويحدد الأقسام اللي يشتغل عليها." />

            <Card className="mb-6">
                <CardHeader title="إضافة موظف" description="يحصل على كلمة مرور مؤقتة، ويُلزم بتغييرها وبإعداد التحقق بخطوتين عند أول دخول." />
                <AddUserForm />
            </Card>

            <Card className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-sm">
                    <thead className="bg-muted text-muted-foreground">
                        <tr className="text-start">
                            <th className="px-4 py-3 text-start font-medium">الموظف</th>
                            <th className="px-4 py-3 text-start font-medium">الدور</th>
                            <th className="px-4 py-3 text-start font-medium">الصلاحيات</th>
                            <th className="px-4 py-3 text-start font-medium">الحالة</th>
                            <th className="px-4 py-3 text-start font-medium">التحقق بخطوتين</th>
                            <th className="px-4 py-3 text-start font-medium">آخر دخول</th>
                            <th className="px-4 py-3 text-start font-medium">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {users.map((u) => {
                            const locked = u.lockedUntil && u.lockedUntil > now;
                            return (
                                <tr key={u.id} className="align-top">
                                    <td className="px-4 py-3">
                                        <p className="font-medium">
                                            {u.name} {u.id === me.id && <span className="text-xs text-muted-foreground">(أنت)</span>}
                                        </p>
                                        <p className="ltr text-xs text-muted-foreground">{u.email}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge tone={u.role === "ADMIN" ? "primary" : "neutral"}>{u.role === "ADMIN" ? "مدير" : "موظف"}</Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        {u.role === "ADMIN" ? (
                                            <span className="text-xs text-muted-foreground">كل الأقسام</span>
                                        ) : (
                                            <PermsForm
                                                userId={u.id}
                                                perms={{
                                                    permCertificates: u.permCertificates,
                                                    permSites: u.permSites,
                                                    permEmails: u.permEmails,
                                                    permLectures: u.permLectures,
                                                    permInternships: u.permInternships,
                                                }}
                                            />
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {!u.isActive ? (
                                            <Badge tone="danger">معطّل</Badge>
                                        ) : locked ? (
                                            <Badge tone="warning">مقفل مؤقتاً</Badge>
                                        ) : u.mustChangePassword ? (
                                            <Badge tone="warning">بانتظار أول دخول</Badge>
                                        ) : (
                                            <Badge tone="success">نشط</Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {u.totpEnabledAt ? <Badge tone="success">مفعّل</Badge> : <Badge>غير مفعّل</Badge>}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(u.lastLoginAt)}</td>
                                    <td className="px-4 py-3">
                                        {u.id === me.id ? (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        ) : (
                                            <UserActions userId={u.id} name={u.name} role={u.role} isActive={u.isActive} has2fa={!!u.totpEnabledAt} />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>
        </>
    );
}
