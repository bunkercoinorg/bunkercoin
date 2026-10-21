"use client";

import { useState } from "react";

const short = (v: string) => (v.length > 12 ? `${v.slice(0, 4)}…${v.slice(-4)}` : v);

export function CopyValue({ value, label }: { value: string; label: string }) {
    const [state, setState] = useState<"idle" | "ok" | "failed">("idle");
    const copy = () => {
        navigator.clipboard.writeText(value).then(
            () => setState("ok"),
            () => setState("failed"),
        );
        setTimeout(() => setState("idle"), 2000);
    };
    return (
        <button type="button" className="bc-cv" data-state={state === "idle" ? undefined : state} onClick={copy} aria-label={`copy ${label} ${value}`}>
            <span className="bc-v">{state === "failed" ? value : short(value)}</span>
            <svg className="bc-ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                {state === "ok" ? <path d="M3 8.5l3 3 7-7" /> : <><rect x="5.5" y="5.5" width="8" height="8" /><path d="M10.5 3.5v-1h-8v8h1" /></>}
            </svg>
            {state !== "idle" && <span className="bc-t" role="status">{state === "ok" ? "copied" : "select and copy"}</span>}
        </button>
    );
}
