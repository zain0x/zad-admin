import { getAuth, type AuthContext } from "@/lib/auth/session";

/** For Route Handlers (PDF, CSV…): a fully signed-in user, or null. */
export async function routeUser(): Promise<AuthContext | null> {
    const auth = await getAuth();
    if (!auth || !auth.session.twoFactorPassed || auth.user.mustChangePassword) return null;
    return auth;
}
