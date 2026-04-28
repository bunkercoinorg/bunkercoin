import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const EU_COUNTRIES = new Set([
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

// blocks EU residents server-side using cloudflare's cf-ipcountry header
export function middleware(request: NextRequest) {
    const country = request.headers.get("cf-ipcountry");

    if (
        country &&
        EU_COUNTRIES.has(country) &&
        !request.nextUrl.pathname.startsWith("/blocked")
    ) {
        const url = request.nextUrl.clone();
        url.pathname = "/blocked";
        return NextResponse.rewrite(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next|favicon.ico|fonts|img|api).*)"],
};
