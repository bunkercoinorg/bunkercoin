"use client";

import NextLink from "next/link";
import { useSyncExternalStore, type ComponentProps } from "react";
import { BYPASS_PARAM, isInternalHref, withBypass } from "@/lib/gate";

const subscribe = (onChange: () => void) => {
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
};
const readBypass = () => new URLSearchParams(window.location.search).get(BYPASS_PARAM);

export function useBypass(): string | null {
    return useSyncExternalStore(subscribe, readBypass, () => null);
}

export function useBypassHref(href: string): string {
    return withBypass(href, useBypass());
}

type LinkProps = Omit<ComponentProps<"a">, "href"> & { href: string };

export function Link({ href, ...rest }: LinkProps) {
    const target = useBypassHref(href);
    if (!isInternalHref(href)) return <a href={href} {...rest} />;
    return <NextLink href={target} {...rest} />;
}
