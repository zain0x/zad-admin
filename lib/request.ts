import { headers } from "next/headers";

/** Client IP and user agent. Nginx (CloudPanel) sets X-Real-IP / X-Forwarded-For. */
export async function getRequestMeta() {
    const h = await headers();
    const ip =
        h.get("x-real-ip") ||
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        null;
    const userAgent = h.get("user-agent")?.slice(0, 255) || null;
    return { ip, userAgent };
}
