import { formatInteger, utcClock } from '@bunkercoin/chain-format';

export const STRIP_COLUMNS = 60;
export const STRIP_STEP_MS = 2000;
export const RADIO_STALE_MS = 10_000;
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

export const kbps = (bps: number) => `${(bps / 1000).toFixed(2)} kb/s`;

export const appendSample = (samples: RadioSample[], next: RadioSample, max = MAX_RADIO_SAMPLES) =>
  [...samples.filter((s) => s.at < next.at), next].slice(-max);

// One column per sampling step ending at `end`; a step without a sample is a gap, never interpolated.
export function stripFrame(
  samples: RadioSample[],
  finalized: FinalizedMark[],
  end: number,
  count = STRIP_COLUMNS,
  step = STRIP_STEP_MS,
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
      ? 'last 2 minutes: no samples'
      : `last 2 minutes: average ${kbps(average)}, ${blocks} ${blocks === 1 ? 'block' : 'blocks'} finalized, ${gaps} ${gaps === 1 ? 'gap' : 'gaps'}`;
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
