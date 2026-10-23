import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Session, User } from "@prisma/client";
import { db } from "@/lib/db";
import { getRequestMeta } from "@/lib/request";

const isProd = process.env.NODE_ENV === "production";
// __Host- prefix: the browser only accepts it over HTTPS, on this exact host, path "/".
export const SESSION_COOKIE = isProd ? "__Host-zad_admin" : "zad_admin_session";
const SESSION_HOURS = 12;
/** A login that has passed the password but not yet 2FA expires quickly. */
const PENDING_MINUTES = 10;

export type AuthContext = { session: Session; user: User };

function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

/** Create a session and set its cookie. Only callable from Server Actions / Route Handlers. */
export async function createSession(userId: string, twoFactorPassed: boolean) {
    const token = randomBytes(32).toString("base64url");
    const { ip, userAgent } = await getRequestMeta();
    const expiresAt = new Date(
        Date.now() + (twoFactorPassed ? SESSION_HOURS * 3600_000 : PENDING_MINUTES * 60_000)
    );
    await db.session.create({
        data: { tokenHash: hashToken(token), userId, twoFactorPassed, ip, userAgent, expiresAt },
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
    });
}

export async function getAuth(): Promise<AuthContext | null> {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await db.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date() || !session.user.isActive) {
        await db.session.delete({ where: { id: session.id } }).catch(() => {});
        return null;
    }
    // Touch at most once a minute.
    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
        await db.session
            .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
            .catch(() => {});
    }
    const { user, ...rest } = session;
    return { session: rest, user };
}

/** Upgrade a pending login to a full one with a fresh token (prevents session fixation). */
export async function promoteSession(current: Session) {
    await db.session.delete({ where: { id: current.id } }).catch(() => {});
    await createSession(current.userId, true);
}

export async function destroySession() {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    store.delete(SESSION_COOKIE);
}

/** For pages/actions behind the full login (password + 2FA + no forced password change). */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<AuthContext> {
    const auth = await getAuth();
    if (!auth) redirect("/login");
    if (!auth.session.twoFactorPassed) {
        redirect(auth.user.totpEnabledAt ? "/login/verify" : "/setup-2fa");
    }
    if (auth.user.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password");
    return auth;
}

export async function requireAdmin(): Promise<AuthContext> {
    const auth = await requireUser();
    if (auth.user.role !== "ADMIN") redirect("/");
    return auth;
}

/** For the 2FA steps: a password-verified session that has not passed 2FA yet. */
export async function requirePendingLogin(): Promise<AuthContext> {
    const auth = await getAuth();
    if (!auth) redirect("/login");
    if (auth.session.twoFactorPassed) redirect("/");
    return auth;
}
