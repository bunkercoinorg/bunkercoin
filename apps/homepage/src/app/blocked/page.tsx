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

export default function Blocked() {
    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
            <div className="text-center">
                <EUStars />
                <h1 className="text-lg sm:text-2xl md:text-3xl font-semibold mb-4 whitespace-nowrap">
                    Not available in the European Union
                </h1>
                <p className="text-neutral-400 text-sm md:text-base leading-relaxed max-w-lg mx-auto">
                    This site is currently not accessible to residents of the European Union.
                </p>
            </div>
        </div>
    );
}
