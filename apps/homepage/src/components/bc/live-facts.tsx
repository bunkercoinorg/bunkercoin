"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";

type Facts = { latest: number; finalized: number; throughputBps: number; at: number };

const POLL_MS = 10_000;
const fmt = new Intl.NumberFormat("en-US");

async function load(signal: AbortSignal): Promise<Facts> {
    const get = async (path: string) => {
        const res = await fetch(`${SITE.api.replace(/\/$/, "")}${path}`, { signal, cache: "no-store" });
        if (!res.ok) throw new Error(`${path} ${res.status}`);
        return res.json();
    };
    const [blocks, radio] = await Promise.all([get("/blocks?limit=50"), get("/radio")]);
    if (!Array.isArray(blocks)) throw new Error("blocks");
    const slots = blocks.filter((b) => Number.isSafeInteger(b?.slot));
    const finalized = slots.filter((b) => b.status === "finalized").map((b) => b.slot);
    const throughputBps = Number(radio?.current_throughput_bps);
    if (!slots.length || !finalized.length || !Number.isFinite(throughputBps)) throw new Error("incomplete");
    return {
        latest: Math.max(...slots.map((b) => b.slot)),
        finalized: Math.max(...finalized),
        throughputBps,
        at: Date.now(),
    };
}

export function LiveFacts() {
    const [facts, setFacts] = useState<Facts | null>(null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let ctrl: AbortController | null = null;
        const tick = () => {
            if (document.visibilityState !== "visible") return;
            ctrl?.abort();
            ctrl = new AbortController();
            load(ctrl.signal).then(setFacts, (e) => {
                if (e?.name !== "AbortError") setFacts(null);
            });
        };
        tick();
        const poll = setInterval(tick, POLL_MS);
        const clock = setInterval(() => setNow(Date.now()), 1000);
        document.addEventListener("visibilitychange", tick);
        return () => {
            ctrl?.abort();
            clearInterval(poll);
            clearInterval(clock);
            document.removeEventListener("visibilitychange", tick);
        };
    }, []);

    if (!facts) return null;
    const ago = Math.max(0, Math.round((now - facts.at) / 1000));
    return (
        <>
            <dl className="bc-ledger">
                <div><dt>latest slot</dt><dd>{fmt.format(facts.latest)}</dd></div>
                <div><dt>finalized</dt><dd>{fmt.format(facts.finalized)}</dd></div>
                <div><dt>radio link</dt><dd>{(facts.throughputBps / 1000).toFixed(2)} kb/s</dd></div>
            </dl>
            <p className="bc-hint mono">from the explorer · checked {ago}s ago</p>
        </>
    );
}
