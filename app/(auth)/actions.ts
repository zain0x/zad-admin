"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { hashPassword, verifyPassword, getDummyHash, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { verifyTotp } from "@/lib/auth/totp";
import { seal, open } from "@/lib/auth/secret-box";
import { generateBackupCodes, hashBackupCode } from "@/lib/auth/backup-codes";
import { ipRateLimited, ACCOUNT_LOCK_MINUTES, ACCOUNT_MAX_FAILURES } from "@/lib/auth/rate-limit";
import {
    createSession,
    destroySession,
    getAuth,
    promoteSession,
    requirePendingLogin,
    requireUser,
} from "@/lib/auth/session";

export type FormState = { error?: string; backupCodes?: string[] } | undefined;

const GENERIC_LOGIN_ERROR = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
const RATE_LIMIT_ERROR = "محاولات كثيرة، حاول بعد 15 دقيقة.";

function minutesLeft(until: Date) {
    return Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
}

/** Count a failed password or 2FA attempt; lock the account after too many. */
async function recordFailure(userId: string, failedCount: number) {
    const count = failedCount + 1;
    const lock = count >= ACCOUNT_MAX_FAILURES;
    await db.user.update({
        where: { id: userId },
        data: {
            failedLoginCount: lock ? 0 : count,
            lockedUntil: lock ? new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60_000) : undefined,
        },
    });
    if (lock) {
        await db.session.deleteMany({ where: { userId, twoFactorPassed: false } });
        await audit({ actorId: userId, action: "auth.locked", targetType: "user", targetId: userId });
    }
    return lock;
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
    const { ip } = await getRequestMeta();
    if (ipRateLimited(`login:${ip}`)) return { error: RATE_LIMIT_ERROR };

    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور." };

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
        await verifyPassword(password, await getDummyHash()); // same timing as a real check
        return { error: GENERIC_LOGIN_ERROR };
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
        return { error: `الحساب مقفل مؤقتاً بسبب محاولات خاطئة. حاول بعد ${minutesLeft(user.lockedUntil)} دقيقة.` };
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok || !user.isActive) {
        await audit({ actorId: user.id, action: "auth.login_failed", targetType: "user", targetId: user.id, details: { reason: ok ? "inactive" : "password" } });
        if (!ok && (await recordFailure(user.id, user.failedLoginCount))) {
            return { error: `الحساب مقفل مؤقتاً بسبب محاولات خاطئة. حاول بعد ${ACCOUNT_LOCK_MINUTES} دقيقة.` };
        }
        return { error: GENERIC_LOGIN_ERROR };
    }

    await createSession(user.id, false);
    redirect(user.totpEnabledAt ? "/login/verify" : "/setup-2fa");
}

export async function verifyTwoFactorAction(_prev: FormState, form: FormData): Promise<FormState> {
    const { session, user } = await requirePendingLogin();
    const { ip } = await getRequestMeta();
    if (ipRateLimited(`2fa:${ip}`)) return { error: RATE_LIMIT_ERROR };
    if (!user.totpSecret || !user.totpEnabledAt) redirect("/setup-2fa");
    if (user.lockedUntil && user.lockedUntil > new Date()) {
        await destroySession();
        redirect("/login");
    }

    const code = String(form.get("code") ?? "").trim();
    let passed = false;

    if (/^\d{3}\s?\d{3}$/.test(code)) {
        const step = verifyTotp(open(user.totpSecret), code, user.totpLastStep);
        if (step !== null) {
            passed = true;
            await db.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
        }
    } else if (code.length >= 8) {
        const backup = await db.backupCode.findFirst({
            where: { userId: user.id, codeHash: hashBackupCode(code), usedAt: null },
        });
        if (backup) {
            // Atomic: only one request can mark the code used.
            const used = await db.backupCode.updateMany({
                where: { id: backup.id, usedAt: null },
                data: { usedAt: new Date() },
            });
            if (used.count === 1) {
                passed = true;
                await audit({ actorId: user.id, action: "auth.backup_code_used", targetType: "user", targetId: user.id });
            }
        }
    }

    if (!passed) {
        await audit({ actorId: user.id, action: "auth.2fa_failed", targetType: "user", targetId: user.id });
        if (await recordFailure(user.id, user.failedLoginCount)) {
            await destroySession();
            redirect("/login");
        }
        return { error: "الرمز غير صحيح أو انتهت صلاحيته." };
    }

    await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await promoteSession(session);
    await audit({ actorId: user.id, action: "auth.login", targetType: "user", targetId: user.id });
    redirect(user.mustChangePassword ? "/change-password" : "/");
}

export async function confirmTotpSetupAction(_prev: FormState, form: FormData): Promise<FormState> {
    const { session, user } = await requirePendingLogin();
    if (user.totpEnabledAt) redirect("/login/verify");
    if (!user.totpPendingSecret) return { error: "انتهت صلاحية الإعداد، حدّث الصفحة وامسح الرمز من جديد." };

    const code = String(form.get("code") ?? "");
    const secret = open(user.totpPendingSecret);
    const step = verifyTotp(secret, code, null);
    if (step === null) return { error: "الرمز غير صحيح. تأكد أن وقت جوالك مضبوط تلقائياً، وجرّب الرمز الجديد." };

    const codes = generateBackupCodes();
    await db.$transaction([
        db.user.update({
            where: { id: user.id },
            data: {
                totpSecret: seal(secret),
                totpPendingSecret: null,
                totpEnabledAt: new Date(),
                totpLastStep: step,
                failedLoginCount: 0,
                lastLoginAt: new Date(),
            },
        }),
        db.backupCode.deleteMany({ where: { userId: user.id } }),
        db.backupCode.createMany({ data: codes.map((c) => ({ userId: user.id, codeHash: hashBackupCode(c) })) }),
    ]);
    // The session is promoted in finishTotpSetupAction: changing the cookie here would
    // re-render this page and lose the backup codes before the user sees them.
    await db.session.update({ where: { id: session.id }, data: { totpSetupDone: true } });
    await audit({ actorId: user.id, action: "auth.2fa_enabled", targetType: "user", targetId: user.id });
    return { backupCodes: codes };
}

export async function finishTotpSetupAction() {
    const { session, user } = await requirePendingLogin();
    if (!session.totpSetupDone || !user.totpEnabledAt) redirect("/login");
    await promoteSession(session);
    await audit({ actorId: user.id, action: "auth.login", targetType: "user", targetId: user.id });
    redirect(user.mustChangePassword ? "/change-password" : "/");
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
    const { session, user } = await requireUser({ allowPasswordChange: true });
    const current = String(form.get("current") ?? "");
    const next = String(form.get("next") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (!(await verifyPassword(current, user.passwordHash))) return { error: "كلمة المرور الحالية غير صحيحة." };
    if (next.length < PASSWORD_MIN_LENGTH) return { error: `كلمة المرور الجديدة ${PASSWORD_MIN_LENGTH} حرفاً على الأقل.` };
    if (next !== confirm) return { error: "كلمتا المرور غير متطابقتين." };
    if (next === current) return { error: "اختر كلمة مرور مختلفة عن الحالية." };

    await db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(next), mustChangePassword: false },
    });
    // Sign out every other device.
    await db.session.deleteMany({ where: { userId: user.id, id: { not: session.id } } });
    await audit({ actorId: user.id, action: "auth.password_changed", targetType: "user", targetId: user.id });
    redirect("/?password=changed");
}

export async function logoutAction() {
    const auth = await getAuth();
    await destroySession();
    if (auth) await audit({ actorId: auth.user.id, action: "auth.logout", targetType: "user", targetId: auth.user.id });
    redirect("/login");
}
