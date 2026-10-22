import { blockTime } from './cadence.ts';
import { asBlock } from './guards.ts';
import { supersedes } from './chain.ts';
import type { RadioBucket } from './strip.ts';
import type { Block } from './types.ts';

export const ARCHIVE_WINDOW_MS = 24 * 3600_000;
export const ARCHIVE_MAX_BLOCKS = 2000;
export const ARCHIVE_VERSION = 1;

// Finished slots (finalized blocks, skips) of the last day, newest first. `floor`
// is the lowest slot the node has, once a backfill page proved nothing is older.
export interface Archive {
  blocks: Block[];
  floor: number | null;
}

export const emptyArchive: Archive = { blocks: [], floor: null };

export interface Stored {
  archive: Archive;
  radio: RadioBucket[];
}

const settled = (b: Block) => b.type === 'skip' || b.status === 'finalized';

export interface Bounds {
  windowMs: number;
  maxBlocks: number;
}

const BOUNDS: Bounds = { windowMs: ARCHIVE_WINDOW_MS, maxBlocks: ARCHIVE_MAX_BLOCKS };

// Time bound first, then count; an untimed skip stays while a timed slot below it does. The
// newest slot before the window stays as its edge, so a quiet stretch reads as covered.
export function bound(blocks: Block[], now: number, { windowMs, maxBlocks }: Bounds = BOUNDS): Block[] {
  const capped = blocks.slice(0, maxBlocks);
  const from = now - windowMs;
  let lowest: number | null = null;
  let edge: number | null = null;
  for (const b of capped) {
    const t = blockTime(b);
    if (t === undefined) continue;
    if (t >= from) lowest = b.slot;
    else if (edge === null) edge = b.slot;
  }
  return capped.filter((b) => {
    const t = blockTime(b);
    if (t === undefined) return lowest !== null && b.slot > lowest;
    return t >= from || (b.slot === edge && lowest !== null);
  });
}

export function mergeArchive(archive: Archive, incoming: Block[], now: number, bounds: Bounds = BOUNDS): Archive {
  const bySlot = new Map(archive.blocks.map((b) => [b.slot, b]));
  let changed = false;
  for (const next of incoming) {
    if (!settled(next)) continue;
    const prev = bySlot.get(next.slot);
    if (prev && !supersedes(next, prev)) continue;
    bySlot.set(next.slot, next);
    changed = true;
  }
  const sorted = changed ? [...bySlot.values()].sort((a, b) => b.slot - a.slot) : archive.blocks;
  const blocks = bound(sorted, now, bounds);
  if (!changed && blocks.length === archive.blocks.length) return archive;
  return { ...archive, blocks };
}

/** The unbroken run of slots from the newest one down. */
export function topRun(blocks: Block[]): Block[] {
  let n = blocks.length ? 1 : 0;
  while (n < blocks.length && blocks[n].slot === blocks[n - 1].slot - 1) n++;
  return blocks.slice(0, n);
}

// Where the next older page has to start, or null once the window is covered,
// the count bound is reached, or the chain has nothing older.
export function backfillCursor(archive: Archive, now: number, bounds: Bounds = BOUNDS): number | null {
  const run = topRun(archive.blocks);
  if (!run.length || archive.blocks.length >= bounds.maxBlocks) return null;
  const bottom = run[run.length - 1];
  if (bottom.slot <= 0 || (archive.floor !== null && bottom.slot <= archive.floor)) return null;
  const t = blockTime(bottom);
  if (t !== undefined && t <= now - bounds.windowMs) return null;
  return bottom.slot;
}

export interface Span {
  from: number;
  to: number;
}

// Time ranges the archive provably holds every slot of: between adjacent slots,
// and from the newest slot to `headAt` while the head is current.
export function coveredSpans(blocks: Block[], headAt: number | null): Span[] {
  const spans: Span[] = [];
  let start = 0;
  for (let i = 1; i <= blocks.length; i++) {
    if (i < blocks.length && blocks[i].slot === blocks[i - 1].slot - 1) continue;
    const times = blocks.slice(start, i).flatMap((b) => blockTime(b) ?? []);
    if (times.length) {
      const to = start === 0 && headAt !== null ? Math.max(headAt, ...times) : Math.max(...times);
      const from = Math.min(...times);
      if (to > from) spans.push({ from, to });
    }
    start = i;
  }
  return spans;
}

export function encodeArchive({ archive, radio }: Stored, savedAt: number): string {
  return JSON.stringify({ v: ARCHIVE_VERSION, savedAt, floor: archive.floor, blocks: archive.blocks, radio });
}

const isBucket = (v: unknown): v is RadioBucket => {
  const o = v as RadioBucket;
  return (
    typeof o === 'object' &&
    o !== null &&
    [o.at, o.sum, o.n, o.peak].every((x) => typeof x === 'number' && Number.isFinite(x)) &&
    o.n > 0
  );
};

// Anything unreadable starts over empty; storage is a convenience, never a source of truth.
const nothing: Stored = { archive: emptyArchive, radio: [] };

export function decodeArchive(text: string | null | undefined, now: number): Stored {
  if (!text) return nothing;
  try {
    const o = JSON.parse(text) as { v?: unknown; floor?: unknown; blocks?: unknown; radio?: unknown };
    if (o.v !== ARCHIVE_VERSION || !Array.isArray(o.blocks)) return nothing;
    const blocks = o.blocks.map((b) => asBlock(b)).filter(settled).sort((a, b) => b.slot - a.slot);
    const radio = Array.isArray(o.radio) ? o.radio.filter(isBucket) : [];
    const floor = typeof o.floor === 'number' && Number.isInteger(o.floor) ? o.floor : null;
    return { archive: { blocks: bound(blocks, now), floor }, radio };
  } catch {
    return nothing;
  }
}
