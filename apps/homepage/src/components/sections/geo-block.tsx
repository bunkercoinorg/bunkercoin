"use client";

import { useEffect, useState } from "react";

const EU_COUNTRIES = new Set([
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

// 12 EU stars arranged in a circle
function EUStars() {
    const stars = Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const r = 80;
        const cx = 100 + r * Math.cos(angle);
        const cy = 100 + r * Math.sin(angle);
        return { cx, cy };
    });

    return (
        <svg viewBox="0 0 200 200" className="w-32 h-32 mx-auto mb-8">
            {stars.map((s, i) => (
                <Star key={i} cx={s.cx} cy={s.cy} size={10} />
            ))}
        </svg>
    );
}

function Star({ cx, cy, size }: { cx: number; cy: number; size: number }) {
    const points = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? size : size / 2.5;
        const a = (i * 36 - 90) * (Math.PI / 180);
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
    return <polygon points={points} fill="#FFCC00" />;
}

// fetches visitor country via cloudflare trace and blocks EU residents
export default function GeoBlock() {
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch("/cdn-cgi/trace")
            .then((r) => (r.ok ? r.text() : ""))
            .then((text) => {
                if (cancelled) return;
                const loc = text.match(/loc=([A-Z]{2})/)?.[1];
                if (loc && EU_COUNTRIES.has(loc)) setBlocked(true);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    if (!blocked) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-neutral-950 flex items-center justify-center px-6">
            <div className="max-w-lg text-center">
                <EUStars />
                <h1 className="text-2xl md:text-3xl font-semibold mb-4">
                    Not available in the European Union
                </h1>
                <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
                    This site is currently not accessible to residents of the European Union.
                </p>
            </div>
        </div>
    );
}
