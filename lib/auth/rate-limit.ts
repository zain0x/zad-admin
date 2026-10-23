/**
 * Per-IP limiter for the login and 2FA forms (in memory: one PM2 process is enough here).
 * Per-account lockout lives in the database (users.failed_login_count / locked_until).
 */
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 20;
const hits = new Map<string, number[]>();

export function ipRateLimited(key: string | null): boolean {
    const k = key ?? "unknown";
    const now = Date.now();
    const recent = (hits.get(k) ?? []).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    hits.set(k, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > MAX_ATTEMPTS;
}

export const ACCOUNT_MAX_FAILURES = 5;
export const ACCOUNT_LOCK_MINUTES = 15;
