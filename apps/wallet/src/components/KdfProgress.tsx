'use client';

/** Derivation is slow on purpose — show it working instead of a dead button. */
export default function KdfProgress({ label, elapsed, fallback }: { label: string; elapsed: number; fallback?: boolean }) {
  return (
    <div className="mt-4.5" role="status" aria-live="polite">
      <div className="h-0.5 overflow-hidden rounded-xs bg-line">
        <div className="h-full w-1/3 animate-kdf-sweep rounded-xs bg-accent motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-50" />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10.5px] tracking-[0.12em] uppercase text-muted">
        <span>{label}</span>
        <span className="text-accent">{elapsed.toFixed(1)}s</span>
      </div>
      {fallback && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
          Slower fallback: the background worker did not respond, so this tab may stop responding until it finishes.
        </p>
      )}
    </div>
  );
}
