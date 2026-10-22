"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const InteractiveGlobe = dynamic(() => import("@/components/sections/interactive-globe"), { ssr: false });

const hasWebGL = () => {
    try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
        return false;
    }
};

function Poster() {
    return (
        <svg viewBox="0 0 520 520" role="img" aria-label="globe with radio links between nodes">
            <g fill="none" stroke="var(--line)">
                <circle cx="260" cy="260" r="200" />
                <ellipse cx="260" cy="260" rx="200" ry="60" stroke="var(--line-soft)" />
                <ellipse cx="260" cy="260" rx="70" ry="200" stroke="var(--line-soft)" />
                <ellipse cx="260" cy="260" rx="140" ry="200" stroke="var(--line-soft)" />
                <path d="M60 260h400" stroke="var(--line-soft)" />
            </g>
        </svg>
    );
}

export function GlobeIsland() {
    const [webgl, setWebgl] = useState(false);
    const [ready, setReady] = useState(false);
    useEffect(() => setWebgl(hasWebGL()), []);
    return (
        <figure className="bc-hp-globe">
            {!ready && <Poster />}
            {webgl && (
                <div style={{ position: "absolute", inset: 0 }} aria-hidden="true">
                    <InteractiveGlobe onReady={() => setReady(true)} />
                </div>
            )}
            <figcaption>illustration</figcaption>
        </figure>
    );
}
