import { formatInteger } from '@bunkercoin/chain-format';
import { blockTime } from './cadence.ts';
import type { Span } from './archive.ts';
import type { Block } from './types.ts';

export const TIMELINE_STEP_MS = 15 * 60_000;
export const TIMELINE_COLUMNS = 96;
export const TIMELINE_STACK = 6;

export interface TimelineEntry {
  slot: number;
  at: number;
  producer?: number;
  skip: boolean;
}

export interface TimelineCell {
  start: number;
  end: number;
  /** Newest first. */
  entries: TimelineEntry[];
  /** Entries present, or the archive provably holds every slot of this stretch. */
  known: boolean;
}

// One cell per `step` ending at `end`; `blocks` newest first. An untimed skip is placed
// at its next newer timed slot, the instant the chain moved past it.
export function timelineCells(
  blocks: Block[],
  spans: Span[],
  end: number,
  count = TIMELINE_COLUMNS,
  step = TIMELINE_STEP_MS,
): TimelineCell[] {
  const start = end - count * step;
  const cells: TimelineCell[] = Array.from({ length: count }, (_, i) => ({
    start: start + i * step,
    end: start + (i + 1) * step,
    entries: [],
    known: false,
  }));
  let newer: number | undefined;
  for (const b of blocks) {
    const own = blockTime(b);
    const at = own ?? (b.type === 'skip' ? newer : undefined);
    if (own !== undefined) newer = own;
    if (at === undefined || at < start || at >= end) continue;
    const entry: TimelineEntry = { slot: b.slot, at, skip: b.type === 'skip' };
    if (b.producer !== undefined) entry.producer = b.producer;
    cells[Math.floor((at - start) / step)].entries.push(entry);
  }
  for (const c of cells) c.known = c.entries.length > 0 || spans.some((s) => s.from < c.end && s.to > c.start);
  return cells;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const hm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const LISTED = 4;

export const entryLabel = (e: TimelineEntry) =>
  `${formatInteger(BigInt(e.slot))} ${e.skip ? 'skipped' : e.producer === undefined ? 'finalized' : `node ${e.producer}`} ${hm(e.at)}`;

export function cellLabel(c: TimelineCell): string {
  const range = `${hm(c.start)}–${hm(c.end)} UTC`;
  if (!c.entries.length) return `${range} · ${c.known ? 'no blocks' : 'no data'}`;
  const skipped = c.entries.filter((e) => e.skip).length;
  const made = c.entries.length - skipped;
  const counts = skipped ? `${count(made, 'block')}, ${skipped} skipped` : count(made, 'block');
  const listed = c.entries.slice(0, LISTED).map(entryLabel).join(', ');
  const more = c.entries.length > LISTED ? `, +${c.entries.length - LISTED} more` : '';
  return `${range} · ${counts} · ${listed}${more}`;
}

const span = (ms: number) => {
  const m = Math.round(ms / 60_000);
  const h = Math.floor(m / 60);
  return h ? (m % 60 ? `${h} h ${m % 60} min` : `${h} h`) : `${m} min`;
};

export function timelineSummary(cells: TimelineCell[], window: string): string {
  const entries = cells.flatMap((c) => c.entries);
  const skipped = entries.filter((e) => e.skip).length;
  const unknown = cells.filter((c) => !c.known);
  const step = cells.length ? cells[0].end - cells[0].start : 0;
  const parts = [`${count(entries.length - skipped, 'block')} finalized`, `${skipped} skipped`];
  if (unknown.length) parts.push(`no data for ${span(unknown.length * step)}`);
  return `${window}: ${parts.join(', ')}`;
}

export interface TimelineColumnView {
  /** Oldest at the bottom: `f` finalized, `s` skipped. */
  stack: ('f' | 's')[];
  more: boolean;
  known: boolean;
  label: string;
}

export function timelineView(cells: TimelineCell[], stack = TIMELINE_STACK): TimelineColumnView[] {
  return cells.map((c) => ({
    stack: c.entries.slice(0, stack).reverse().map((e) => (e.skip ? 's' : 'f')),
    more: c.entries.length > stack,
    known: c.known,
    label: cellLabel(c),
  }));
}
