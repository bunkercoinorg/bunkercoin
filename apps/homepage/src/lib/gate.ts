export const BLOCKED_COUNTRIES = new Set(["DE"]);
export const BYPASS_PARAM = "bnkr";
export const BLOCKED_PATH = "/blocked";
const EXEMPT_PATHS = ["/whitepaper", "/view"];

export type GateRequest = {
    url: string;
    method: string;
    country: string | null;
    referer: string | null;
};

export type GateDecision =
    | { action: "next" }
    | { action: "rewrite"; pathname: string }
    | { action: "redirect"; url: string };

const isExempt = (pathname: string) =>
    EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function isInternalHref(href: string): boolean {
    return href.startsWith("/") && !href.startsWith("//");
}

export function withBypass(href: string, value: string | null): string {
    if (value === null || !isInternalHref(href)) return href;
    const hashAt = href.indexOf("#");
    const base = hashAt === -1 ? href : href.slice(0, hashAt);
    const hash = hashAt === -1 ? "" : href.slice(hashAt);
    const queryAt = base.indexOf("?");
    const params = new URLSearchParams(queryAt === -1 ? "" : base.slice(queryAt + 1));
    if (params.has(BYPASS_PARAM)) return href;
    const param = value ? `${BYPASS_PARAM}=${encodeURIComponent(value)}` : BYPASS_PARAM;
    const sep = queryAt === -1 ? "?" : base.endsWith("?") || base.endsWith("&") ? "" : "&";
    return `${base}${sep}${param}${hash}`;
}

function refererBypass(referer: string | null, origin: string): string | null {
    if (!referer) return null;
    try {
        const ref = new URL(referer);
        return ref.origin === origin ? ref.searchParams.get(BYPASS_PARAM) : null;
    } catch {
        return null;
    }
}

export function gate({ url, method, country, referer }: GateRequest): GateDecision {
    const u = new URL(url);
    const bypass = u.searchParams.has(BYPASS_PARAM);

    if (!bypass && (method === "GET" || method === "HEAD")) {
        const inherited = refererBypass(referer, u.origin);
        if (inherited !== null) {
            return { action: "redirect", url: new URL(withBypass(u.pathname + u.search, inherited), u.origin).toString() };
        }
    }

    const blocked = country !== null && BLOCKED_COUNTRIES.has(country);
    if (blocked && !bypass && !isExempt(u.pathname) && u.pathname !== BLOCKED_PATH) {
        return { action: "rewrite", pathname: BLOCKED_PATH };
    }
    return { action: "next" };
}
