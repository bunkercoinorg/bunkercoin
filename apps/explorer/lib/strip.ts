import { formatInteger, utcClock } from '@bunkercoin/chain-format';

export const STRIP_COLUMNS = 60;
export const STRIP_STEP_MS = 2000;
// The overview strip: 30 minutes of 30s buckets, each the mean of ~15 two-second samples.
export const RADIO_BUCKET_MS = 30_000;
export const RADIO_COLUMNS = 60;
export const MAX_RADIO_BUCKETS = 120;
export const RADIO_STALE_MS = 60_000;
export const MAX_RADIO_SAMPLES = 120;

export interface RadioSample {
  at: number;
  bps: number;
}

export interface FinalizedMark {
  slot: number;
  at: number;
}

export interface StripColumnData {
  level: number | null;
  finalized?: string;
}

export interface StripFrame {
  columns: StripColumnData[];
  summary: string;
  peak: string | undefined;
  samples: { time: string; value: string; finalized?: string }[];
}

export const kbps = (bps: number) => (bps < 1000 ? `${Math.round(bps)} b/s` : `${(bps / 1000).toFixed(2)} kb/s`);

export interface RadioBucket {
  at: number;
  sum: number;
  n: number;
  peak: number;
}

// Buckets oldest first, keyed by their start; a sample older than the newest bucket is dropped.
export function addToBuckets(buckets: RadioBucket[], s: RadioSample, step = RADIO_BUCKET_MS, max = MAX_RADIO_BUCKETS): RadioBucket[] {
  const at = Math.floor(s.at / step) * step;
  const last = buckets[buckets.length - 1];
  if (last && at < last.at) return buckets;
  if (last && at === last.at) {
    return [...buckets.slice(0, -1), { at, sum: last.sum + s.bps, n: last.n + 1, peak: Math.max(last.peak, s.bps) }];
  }
  return [...buckets, { at, sum: s.bps, n: 1, peak: s.bps }].slice(-max);
}

// Stored buckets fill in behind the ones gathered since load.
export const joinBuckets = (older: RadioBucket[], newer: RadioBucket[], max = MAX_RADIO_BUCKETS) =>
  [...older.filter((b) => !newer.length || b.at < newer[0].at), ...newer].slice(-max);

/** Each bucket as one sample at its end, so it lands in its own strip column. */
export const bucketSamples = (buckets: RadioBucket[], step = RADIO_BUCKET_MS): RadioSample[] =>
  buckets.map((b) => ({ at: b.at + step, bps: b.sum / b.n }));

export const alignedEnd = (now: number, step: number) => Math.ceil(now / step) * step;

export const appendSample = (samples: RadioSample[], next: RadioSample, max = MAX_RADIO_SAMPLES) =>
  [...samples.filter((s) => s.at < next.at), next].slice(-max);

// One column per sampling step ending at `end`; a step without a sample is a gap, never interpolated.
export function stripFrame(
  samples: RadioSample[],
  finalized: FinalizedMark[],
  end: number,
  count = STRIP_COLUMNS,
  step = STRIP_STEP_MS,
  window = 'last 2 minutes',
): StripFrame {
  const start = end - count * step;
  const bucket = (at: number) => (at > start && at <= end ? Math.min(count - 1, Math.floor((at - start - 1) / step)) : -1);
  const values: (number | null)[] = Array(count).fill(null);
  const owner: (RadioSample | undefined)[] = Array(count).fill(undefined);
  const shown: { sample: RadioSample; i: number }[] = [];
  for (const s of samples) {
    const i = bucket(s.at);
    if (i < 0) continue;
    values[i] = s.bps;
    owner[i] = s;
    shown.push({ sample: s, i });
  }
  const marks: (FinalizedMark | undefined)[] = Array(count).fill(undefined);
  for (const f of finalized) {
    const i = bucket(f.at);
    if (i >= 0 && (!marks[i] || marks[i]!.slot < f.slot)) marks[i] = f;
  }
  // A mark on a gap column is never drawn, so it is neither counted nor listed.
  const drawn = marks.map((m, i) => (values[i] === null ? undefined : m));
  const lit = values.filter((v): v is number => v !== null);
  const peak = lit.length ? Math.max(...lit) : 0;
  const columns = values.map((v, i): StripColumnData => {
    if (v === null) return { level: null };
    const level = v <= 0 || peak <= 0 ? 0 : Math.max(1, Math.ceil((8 * v) / peak));
    const m = drawn[i];
    return m ? { level, finalized: `${formatInteger(BigInt(m.slot))} finalized ${utcClock(m.at)}` } : { level };
  });
  const gaps = count - lit.length;
  const blocks = drawn.filter(Boolean).length;
  const average = lit.length ? lit.reduce((a, b) => a + b, 0) / lit.length : null;
  const summary =
    average === null
      ? `${window}: no samples`
      : `${window}: average ${kbps(average)}, ${blocks} ${blocks === 1 ? 'block' : 'blocks'} finalized, ${gaps} ${gaps === 1 ? 'gap' : 'gaps'}`;
  return {
    columns,
    summary,
    peak: lit.length ? kbps(peak) : undefined,
    samples: shown
      .slice(-10)
      .reverse()
      .map(({ sample: s, i }) => {
        const m = owner[i] === s ? drawn[i] : undefined;
        return m ? { time: utcClock(s.at), value: kbps(s.bps), finalized: `${formatInteger(BigInt(m.slot))} at ${utcClock(m.at)}` } : { time: utcClock(s.at), value: kbps(s.bps) };
      }),
  };
}
