import { atom } from 'jotai';
import { emptyChain, highestFinalized, type Applied, type ChainView } from './chain.ts';
import type { HistoryWindow } from './history.ts';
import type { Node, RadioStats } from './types.ts';

export const BLOCK_PAGE_SIZE = 20;
export const INITIAL_DISPLAY_COUNT = 50;

export interface FeedState {
  lastSuccess: number | null;
  error: string | null;
}

const idleFeed: FeedState = { lastSuccess: null, error: null };

export const chainAtom = atom<ChainView>(emptyChain);
export const blocksAtom = atom((get) => get(chainAtom).blocks);
export const hasMoreBlocksAtom = atom((get) => !get(chainAtom).exhausted);
export const highestFinalizedSlotAtom = atom((get) => highestFinalized(get(blocksAtom))?.slot ?? null);

export const blocksFeedAtom = atom<FeedState>(idleFeed);
export const nodesFeedAtom = atom<FeedState>(idleFeed);
export const loadMoreErrorAtom = atom<string | null>(null);
export const isLoadingMoreAtom = atom(false);

export const nodesAtom = atom<Node[]>([]);

export type WsStatus = 'connecting' | 'open' | 'closed';
export const wsStatusAtom = atom<WsStatus>('connecting');
export const radioStatsAtom = atom<RadioStats | null>(null);

export const showSkippedSlotsAtom = atom(false);
export const displayCountAtom = atom(INITIAL_DISPLAY_COUNT);
// Set while the list pages through history below the live window.
export const historyAtom = atom<HistoryWindow | null>(null);
export const historyLoadAtom = atom<{ loading: boolean; error: string | null }>({ loading: false, error: null });
export const selectedBlockHashAtom = atom<string | null>(null);

// Producers of blocks that just turned finalized; `seq` makes each batch distinct.
export const finalizedFlashAtom = atom<{ seq: number; producers: number[] }>({ seq: 0, producers: [] });

export const applyChainAtom = atom(null, (get, set, step: (view: ChainView) => Applied) => {
  const view = get(chainAtom);
  const { view: next, finalized } = step(view);
  if (next !== view) set(chainAtom, next);
  if (finalized.length) {
    set(finalizedFlashAtom, { seq: get(finalizedFlashAtom).seq + 1, producers: finalized.map((f) => f.producer) });
  }
});
