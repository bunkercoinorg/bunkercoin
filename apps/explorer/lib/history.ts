import { fetchOlderThan, type PageFetcher } from './chain.ts';
import type { Block } from './types.ts';

export const HISTORY_PAGE_SIZE = 50;
export const MAX_HISTORY_ANCHORS = 100;
const MAX_FILLS = 3;

// A page of history is everything older than `cursor`; `estimate` is its
// approximate row offset from the head.
export interface HistoryAnchor {
  cursor: number;
  estimate: number;
}

export interface HistoryWindow {
  anchors: HistoryAnchor[];
  blocks: Block[];
  exhausted: boolean;
  nextOffset: number;
}

// A straddling page only yields the rows below the cursor, so top it up.
export async function fetchHistoryPage(
  anchor: HistoryAnchor,
  limit: number,
  fetchPage: PageFetcher,
): Promise<Omit<HistoryWindow, 'anchors'>> {
  const blocks: Block[] = [];
  let cursor = anchor.cursor;
  let estimate = anchor.estimate;
  for (let fill = 0; fill < MAX_FILLS; fill++) {
    const page = await fetchOlderThan(cursor, estimate, limit, fetchPage);
    const taken = page.blocks.slice(0, limit - blocks.length);
    blocks.push(...taken);
    const exhausted = page.exhausted && taken.length === page.blocks.length;
    if (exhausted || blocks.length >= limit || !taken.length) {
      return { blocks, exhausted, nextOffset: page.nextOffset };
    }
    cursor = blocks[blocks.length - 1].slot;
    estimate = page.nextOffset;
  }
  return { blocks, exhausted: false, nextOffset: estimate };
}

export function olderAnchor(w: HistoryWindow): HistoryAnchor | null {
  if (w.exhausted || !w.blocks.length) return null;
  return { cursor: w.blocks[w.blocks.length - 1].slot, estimate: w.nextOffset };
}

// Only the way back is remembered, and only so far; past it "newer" returns to live.
export const pushAnchor = (anchors: HistoryAnchor[], next: HistoryAnchor) =>
  [...anchors, next].slice(-MAX_HISTORY_ANCHORS);
