'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSetAtom, useStore } from 'jotai';
import { applyChainAtom, BLOCK_PAGE_SIZE, chainAtom, isLoadingMoreAtom, loadMoreErrorAtom } from './atoms';
import { api, errorMessage, isAbort } from './api';
import { applyOlder, cursorSlot, fetchOlderThan, MAX_RETAINED_BLOCKS } from './chain';
import { createGate } from './request-gate';

// Extends the live window downwards; resolves true once older rows (or the end of history) were merged.
export function useLoadOlder() {
  const store = useStore();
  const applyChain = useSetAtom(applyChainAtom);
  const setLoadingMore = useSetAtom(isLoadingMoreAtom);
  const setLoadMoreError = useSetAtom(loadMoreErrorAtom);
  const [gate] = useState(createGate);

  useEffect(
    () => () => {
      gate.cancel();
      setLoadingMore(false);
    },
    [gate, setLoadingMore],
  );

  return useCallback(async (): Promise<boolean> => {
    const view = store.get(chainAtom);
    const cursor = cursorSlot(view);
    if (gate.busy() || cursor === null || view.exhausted) return false;
    if (view.blocks.length + BLOCK_PAGE_SIZE > MAX_RETAINED_BLOCKS) return false;
    const ticket = gate.begin();
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const older = await fetchOlderThan(cursor, view.blocks.length, BLOCK_PAGE_SIZE, (offset, limit) =>
        api.getBlocks(offset, limit, { signal: ticket.signal }),
      );
      // The head may have reset or the cap moved the cursor meanwhile.
      if (!ticket.current() || cursorSlot(store.get(chainAtom)) !== cursor) return false;
      applyChain((v) => applyOlder(v, older.blocks, older.exhausted));
      return true;
    } catch (e) {
      if (ticket.current() && !isAbort(e)) setLoadMoreError(errorMessage(e));
      return false;
    } finally {
      if (ticket.current()) setLoadingMore(false);
      gate.finish(ticket);
    }
  }, [store, gate, applyChain, setLoadingMore, setLoadMoreError]);
}
