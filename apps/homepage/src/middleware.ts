import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { gate } from "@/lib/gate";

export function middleware(request: NextRequest) {
    const decision = gate({
        url: request.url,
        method: request.method,
        country: request.headers.get("cf-ipcountry"),
        referer: request.headers.get("referer"),
    });

    if (decision.action === "redirect") return NextResponse.redirect(decision.url, 307);
    if (decision.action === "rewrite") {
        const url = request.nextUrl.clone();
        url.pathname = decision.pathname;
        return NextResponse.rewrite(url);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next|favicon.ico|fonts|img|api).*)"],
};
