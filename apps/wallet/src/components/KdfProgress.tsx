'use client';

/** Derivation is slow on purpose — show it working instead of a dead button. */
export default function KdfProgress({ label, elapsed }: { label: string; elapsed: number }) {
  return (
    <div className="kdf" role="status" aria-live="polite">
      <div className="kdf-track">
        <div className="kdf-bar" />
      </div>
      <div className="kdf-line">
        <span>{label}</span>
        <span className="t">{elapsed.toFixed(1)}s</span>
      </div>
    </div>
  );
}
