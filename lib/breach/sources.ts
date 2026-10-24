/**
 * Email breach lookup across two sources, queried in parallel and merged:
 *  - Have I Been Pwned (needs HIBP_API_KEY): verified, well-known breaches.
 *  - LeakCheck public API (no key): also covers combolists and stealer logs.
 */

const REQUEST_TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 500;

export type SourceName = "Have I Been Pwned" | "LeakCheck";

export type Breach = {
    name: string;
    /** Display date, e.g. "May 2019"; empty when the source has none. */
    date: string;
};

export type BreachReport = {
    breaches: Breach[];
    /** Arabic labels for the kinds of data exposed, most sensitive first. */
    exposed: string[];
    /** Sources that answered successfully. */
    sources: SourceName[];
    /** True when at least one configured source failed, so the result may be incomplete. */
    partial: boolean;
};

type RawBreach = { name: string; month: string; source: SourceName };
type SourceResult = { breaches: RawBreach[]; fields: string[] };

export class AllSourcesFailedError extends Error {}

/* ---------- Sources ---------- */

async function fetchJson(url: string, headers: Record<string, string> = {}) {
    const res = await fetch(url, {
        headers: { "user-agent": "Zad-Security", ...headers },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return {
        res,
        body: res.status === 204 ? null : await res.json().catch(() => null),
    };
}

async function checkHibp(email: string, apiKey: string): Promise<SourceResult> {
    const { res, body } = await fetchJson(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
        { "hibp-api-key": apiKey }
    );
    if (res.status === 404) return { breaches: [], fields: [] };
    if (!res.ok || !Array.isArray(body))
        throw new Error(`HIBP responded ${res.status}`);

    const list = body as {
        Title: string;
        BreachDate?: string;
        DataClasses?: string[];
    }[];
    return {
        breaches: list.map((b) => ({
            name: b.Title,
            month: (b.BreachDate ?? "").slice(0, 7),
            source: "Have I Been Pwned",
        })),
        fields: list.flatMap((b) => b.DataClasses ?? []),
    };
}

async function checkLeakCheck(email: string): Promise<SourceResult> {
    const { res, body } = await fetchJson(
        `https://leakcheck.io/api/public?check=${encodeURIComponent(email)}`
    );
    if (body?.success === false && body.error === "Not found")
        return { breaches: [], fields: [] };
    if (!res.ok || body?.success !== true) {
        throw new Error(
            `LeakCheck responded ${res.status}: ${body?.error ?? "unknown error"}`
        );
    }

    const sources = (body.sources ?? []) as { name: string; date?: string }[];
    return {
        breaches: sources.map((s) => ({
            name: s.name,
            month: s.date ?? "",
            source: "LeakCheck",
        })),
        fields: (body.fields ?? []) as string[],
    };
}

/* ---------- Merging ---------- */

/** "Canva.com", "canva" and "Canva (2019)" all collapse to "canva". */
function normalizeName(name: string) {
    return name
        .toLowerCase()
        .replace(/\(.*?\)/g, "")
        .trim()
        .replace(/\.(com|net|org|io|co|ru|me|info|biz|gg|tv)(\.[a-z]{2})?$/, "")
        .replace(/[^a-z0-9؀-ۿ]/g, "");
}

function formatMonth(month: string) {
    const [year, mon] = month.split("-").map(Number);
    if (!year) return "";
    if (!mon) return String(year);
    return new Date(Date.UTC(year, mon - 1)).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

function mergeBreaches(raw: RawBreach[]): Breach[] {
    const byName = new Map<string, RawBreach>();
    for (const b of raw) {
        const key = normalizeName(b.name) || b.name.toLowerCase();
        const existing = byName.get(key);
        if (!existing) {
            byName.set(key, b);
            continue;
        }
        // Prefer HIBP's curated title, and keep whichever entry has a date.
        const preferred =
            b.source === "Have I Been Pwned" && existing.source !== b.source
                ? b
                : existing;
        byName.set(key, {
            ...preferred,
            month: preferred.month || existing.month || b.month,
        });
    }
    return [...byName.values()]
        .sort((a, b) => b.month.localeCompare(a.month))
        .map((b) => ({ name: b.name, date: formatMonth(b.month) }));
}

/** Source field names (HIBP data classes + LeakCheck fields) → Arabic label, in sensitivity order. */
const EXPOSED_LABELS: [label: string, keys: string[]][] = [
    ["كلمة المرور", ["password", "passwords", "password hints"]],
    [
        "رقم الهوية",
        ["ssn", "government issued ids", "national ids", "passport numbers"],
    ],
    [
        "بيانات بطاقات الدفع",
        ["credit cards", "partial credit card data", "bank account numbers"],
    ],
    ["رقم الهاتف", ["phone", "phone numbers"]],
    ["العنوان", ["address", "physical addresses", "zip", "city", "state"]],
    ["تاريخ الميلاد", ["dob", "dates of birth"]],
    ["الاسم", ["name", "names", "first_name", "last_name", "middle_name"]],
    ["اسم المستخدم", ["username", "usernames", "profile_name"]],
    ["عنوان IP", ["ip", "ip1", "ip2", "ip addresses"]],
];

function exposedLabels(fields: string[]) {
    const set = new Set(fields.map((f) => f.toLowerCase()));
    return EXPOSED_LABELS.filter(([, keys]) =>
        keys.some((k) => set.has(k))
    ).map(([label]) => label);
}

/* ---------- Public API ---------- */

const cache = new Map<string, { at: number; report: BreachReport }>();

export async function lookupBreaches(email: string): Promise<BreachReport> {
    const cached = cache.get(email);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.report;

    const hibpKey = process.env.HIBP_API_KEY;
    const checks: [SourceName, Promise<SourceResult>][] = [
        ["LeakCheck", checkLeakCheck(email)],
    ];
    if (hibpKey)
        checks.unshift(["Have I Been Pwned", checkHibp(email, hibpKey)]);

    const settled = await Promise.allSettled(checks.map(([, p]) => p));

    const ok: SourceResult[] = [];
    const sources: SourceName[] = [];
    settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
            ok.push(r.value);
            sources.push(checks[i][0]);
        } else {
            console.error(
                `Breach lookup via ${checks[i][0]} failed:`,
                r.reason
            );
        }
    });

    if (ok.length === 0)
        throw new AllSourcesFailedError("All breach sources failed");

    const report: BreachReport = {
        breaches: mergeBreaches(ok.flatMap((r) => r.breaches)),
        exposed: exposedLabels(ok.flatMap((r) => r.fields)),
        sources,
        partial: ok.length < checks.length,
    };

    // Only cache complete answers, so a temporary outage isn't remembered.
    if (!report.partial) {
        if (cache.size >= CACHE_MAX_ENTRIES)
            cache.delete(cache.keys().next().value!);
        cache.set(email, { at: Date.now(), report });
    }
    return report;
}
