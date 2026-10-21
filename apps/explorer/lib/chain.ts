import type { Block, SlotStatus } from './types.ts';

export const MAX_RETAINED_BLOCKS = 500;

// Blocks newest-first. `restTop` is the highest slot confirmed by a REST page:
// live inserts above it are unverified, so a head page that does not reach it
// leaves a gap. `exhausted` is only ever set by an older-page fetch.
export interface ChainView {
  blocks: Block[];
  restTop: number | null;
  exhausted: boolean;
}

export interface FinalizedTransition {
  slot: number;
  producer: number;
}

export interface Applied {
  view: ChainView;
  finalized: FinalizedTransition[];
}

export const emptyChain: ChainView = { blocks: [], restTop: null, exhausted: false };

const RANK: Record<SlotStatus, number> = { pending: 0, proposed: 1, notarized: 2, finalized: 3 };

// Status only moves forward, so a late response can never regress a row.
function supersedes(next: Block, prev: Block): boolean {
  const d = RANK[next.status] - RANK[prev.status];
  if (d !== 0) return d > 0;
  return (
    next.type !== prev.type ||
    next.hash !== prev.hash ||
    (next.finalized_timestamp !== undefined && prev.finalized_timestamp === undefined)
  );
}

export function finalizedTransition(prev: Block | undefined, next: Block): FinalizedTransition | null {
  if (!prev || prev.status === 'finalized') return null;
  if (next.status !== 'finalized' || next.type !== 'block' || next.producer === undefined) return null;
  return { slot: next.slot, producer: next.producer };
}

function merge(view: ChainView, incoming: Block[], retain: number): Applied {
  const bySlot = new Map(view.blocks.map((b) => [b.slot, b]));
  const finalized: FinalizedTransition[] = [];
  for (const next of incoming) {
    const prev = bySlot.get(next.slot);
    if (prev && !supersedes(next, prev)) continue;
    const t = finalizedTransition(prev, next);
    if (t) finalized.push(t);
    bySlot.set(next.slot, next);
  }
  const sorted = [...bySlot.values()].sort((a, b) => b.slot - a.slot);
  const blocks = sorted.slice(0, retain);
  return {
    view: { ...view, blocks, exhausted: view.exhausted && blocks.length === sorted.length },
    finalized,
  };
}

const top = (blocks: Block[]) => (blocks.length ? blocks[0].slot : null);
const maxSlot = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

export function applyHead(view: ChainView, page: Block[], pageLimit: number, retain = MAX_RETAINED_BLOCKS): Applied {
  if (!page.length) return { view, finalized: [] };
  const bottom = page[page.length - 1].slot;
  const gap = page.length >= pageLimit && view.restTop !== null && bottom > view.restTop + 1;
  if (gap) {
    const fresh = merge({ ...emptyChain, blocks: view.blocks.filter((b) => b.slot >= bottom) }, page, retain);
    return { view: { ...fresh.view, restTop: top(page), exhausted: false }, finalized: fresh.finalized };
  }
  const r = merge(view, page, retain);
  return { view: { ...r.view, restTop: maxSlot(view.restTop, top(page)) }, finalized: r.finalized };
}

export function applyOlder(view: ChainView, older: Block[], exhausted: boolean, retain = MAX_RETAINED_BLOCKS): Applied {
  const r = merge({ ...view, exhausted }, older, retain);
  return { view: { ...r.view, restTop: maxSlot(view.restTop, top(older)) }, finalized: r.finalized };
}

export function applyLive(view: ChainView, block: Block, retain = MAX_RETAINED_BLOCKS): Applied {
  return merge(view, [block], retain);
}

export function applyStatusChange(
  view: ChainView,
  change: { slot: number; hash: string; status: SlotStatus },
  retain = MAX_RETAINED_BLOCKS,
): Applied {
  const prev = view.blocks.find((b) => b.slot === change.slot && b.hash === change.hash);
  if (!prev) return { view, finalized: [] };
  return merge(view, [{ ...prev, status: change.status }], retain);
}

export const cursorSlot = (view: ChainView) => (view.blocks.length ? view.blocks[view.blocks.length - 1].slot : null);

export const highestFinalized = (blocks: Block[]) =>
  blocks.find((b) => b.status === 'finalized' && b.type === 'block' && b.producer !== undefined) ?? null;

export type PageFetcher = (offset: number, limit: number) => Promise<Block[]>;

export interface OlderPage {
  blocks: Block[];
  exhausted: boolean;
  // Offset just past the returned rows, the estimate for the next older page.
  nextOffset: number;
}

export const CURSOR_OVERLAP = 5;
const MAX_CURSOR_PROBES = 24;

// The node only pages by row offset from the head, which drifts as new slots
// land. Probe from an estimate until a page straddles the cursor, then keep
// only rows strictly older than it.
export async function fetchOlderThan(
  cursor: number,
  estimate: number,
  limit: number,
  fetchPage: PageFetcher,
): Promise<OlderPage> {
  let offset = Math.max(0, estimate - CURSOR_OVERLAP);
  let lower = 0;
  let upper: number | null = null;
  let step = limit;
  for (let probe = 0; probe < MAX_CURSOR_PROBES; probe++) {
    const page = await fetchPage(offset, limit);
    if (!page.length) {
      if (offset === 0) return { blocks: [], exhausted: true, nextOffset: 0 };
      upper = offset;
    } else {
      const newest = page[0].slot;
      const oldest = page[page.length - 1].slot;
      if (oldest >= cursor) {
        if (page.length < limit) return { blocks: [], exhausted: true, nextOffset: offset + page.length };
        lower = offset + page.length - 1;
      } else if (newest < cursor && offset > 0) {
        upper = offset;
      } else {
        return { blocks: page.filter((b) => b.slot < cursor), exhausted: page.length < limit, nextOffset: offset + page.length };
      }
    }
    offset = upper === null ? lower + step : Math.floor((lower + upper) / 2);
    step *= 2;
  }
  throw new Error('Could not locate the pagination cursor');
}

// Both the live cache and the rendered window are fixed; history beyond them
// is paged explicitly instead of growing either one.
export const MAX_RENDERED_ROWS = 100;

export type LiveScroll = 'grow' | 'fetch' | 'browse' | 'end';

// What reaching the bottom of the live list does, given `shown` rendered rows
// out of `available` filtered rows in a cache of `cached` rows.
export function liveScroll(
  shown: number,
  available: number,
  cached: number,
  exhausted: boolean,
  pageSize: number,
): LiveScroll {
  if (shown < MAX_RENDERED_ROWS && shown < available) return 'grow';
  if (shown < MAX_RENDERED_ROWS && !exhausted && cached + pageSize <= MAX_RETAINED_BLOCKS) return 'fetch';
  if (exhausted && shown >= available) return 'end';
  return 'browse';
}
