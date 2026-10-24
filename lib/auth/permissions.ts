import { redirect } from "next/navigation";
import { requireUser, type AuthContext } from "@/lib/auth/session";
import { can, type Section } from "@/lib/auth/sections";

export { SECTIONS, can, sectionsOf, type Section } from "@/lib/auth/sections";

/** For pages and server actions of a section (server only). */
export async function requireSection(section: Section): Promise<AuthContext> {
    const auth = await requireUser();
    if (!can(auth.user, section)) redirect("/?denied=1");
    return auth;
}
