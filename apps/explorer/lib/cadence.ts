import type { Block } from './types.ts';

// Relative times re-render at this pace, never per second.
export const CLOCK_MS = 15_000;
export const CADENCE_SAMPLE = 24;
export const STALE_FACTOR = 3;
const FALLBACK_CADENCE_MS = 60_000;
const MIN_STALE_MS = 3 * 60_000;
const MAX_STALE_MS = 60 * 60_000;

export const blockTime = (b: Block) => b.finalized_timestamp ?? b.proposed_timestamp;
export const producedAt = (b: Block) => b.proposed_timestamp ?? b.finalized_timestamp;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Finalization instants of finalized blocks, newest first, one per slot. */
export function finalizedTimes(blocks: Block[]): number[] {
  const bySlot = new Map<number, number>();
  for (const b of blocks) {
    if (b.type === 'block' && b.status === 'finalized' && b.finalized_timestamp !== undefined) bySlot.set(b.slot, b.finalized_timestamp);
  }
  return [...bySlot.entries()].sort((a, b) => b[0] - a[0]).map(([, t]) => t);
}

/** Gaps between consecutive finalized blocks, oldest first. */
export function intervals(blocks: Block[], sample: number): number[] {
  const t = finalizedTimes(blocks).slice(0, sample + 1);
  const out: number[] = [];
  for (let i = t.length - 1; i > 0; i--) if (t[i - 1] > t[i]) out.push(t[i - 1] - t[i]);
  return out;
}

// A median, because one radio outage would drag a mean to hours.
export function estimateCadence(blocks: Block[], sample = CADENCE_SAMPLE): number | null {
  const gaps = intervals(blocks, sample);
  return gaps.length ? median(gaps) : null;
}

export function staleAfter(cadenceMs: number | null): number {
  return Math.min(MAX_STALE_MS, Math.max(MIN_STALE_MS, STALE_FACTOR * (cadenceMs ?? FALLBACK_CADENCE_MS)));
}

/** `52 s`, `4.6 min`, `1.5 h`. */
export function formatSpan(ms: number): string {
  const s = ms / 1000;
  if (s < 100) return `${Math.max(1, Math.round(s))} s`;
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (s < 100 * 60) return `${trim(s / 60)} min`;
  return `${trim(s / 3600)} h`;
}

export const cadenceLabel = (ms: number) => `~1 block / ${formatSpan(ms)}`;

/** Coarse age for a slow chain: `<1 min`, `4 min`, `2 h 10 min`, `3 h`, `2 d`. */
export function coarseAge(ms: number, now: number): string {
  const m = Math.max(0, Math.floor((now - ms) / 60_000));
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 3) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/** `checked 4 min ago`; empty until both instants are known. */
export const checkedAgo = (at: number | null, now: number | null) => (at === null || now === null ? '' : `checked ${coarseAge(at, now)} ago`);

export interface CadenceSeries {
  /** Interval per point, oldest first, each scaled to 0..1 against `cap`; 1 means at or above the cap. */
  points: number[];
  median: number;
  /** Values above this are drawn clipped (an outage would flatten everything else). */
  cap: number;
  clipped: number;
}

export function cadenceSeries(blocks: Block[], sample: number): CadenceSeries | null {
  const gaps = intervals(blocks, sample);
  if (gaps.length < 2) return null;
  const mid = median(gaps);
  const cap = Math.min(Math.max(...gaps), STALE_FACTOR * mid);
  return {
    points: gaps.map((g) => (cap > 0 ? Math.min(1, g / cap) : 0)),
    median: mid,
    cap,
    clipped: gaps.filter((g) => g > cap).length,
  };
}
