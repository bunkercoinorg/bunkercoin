'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from 'jotai';
import { historyAtom, historyLoadAtom } from './atoms';
import { api, errorMessage, isAbort } from './api';
import { createGate } from './request-gate';
import { fetchHistoryPage, HISTORY_PAGE_SIZE, olderAnchor, pushAnchor, type HistoryAnchor } from './history';

const idle = { loading: false, error: null };

// Explicit paging below the live window; anchors commit only once their page loads.
export function useHistory() {
  const store = useStore();
  const [gate] = useState(createGate);

  useEffect(
    () => () => {
      gate.cancel();
      store.set(historyLoadAtom, idle);
    },
    [gate, store],
  );

  const load = useCallback(
    async (anchors: HistoryAnchor[]) => {
      const ticket = gate.begin();
      store.set(historyLoadAtom, { loading: true, error: null });
      try {
        const page = await fetchHistoryPage(anchors[anchors.length - 1], HISTORY_PAGE_SIZE, (offset, limit) =>
          api.getBlocks(offset, limit, { signal: ticket.signal }),
        );
        if (!ticket.current()) return;
        store.set(historyAtom, { anchors, ...page });
        store.set(historyLoadAtom, idle);
      } catch (e) {
        if (ticket.current() && !isAbort(e)) store.set(historyLoadAtom, { loading: false, error: errorMessage(e) });
      } finally {
        gate.finish(ticket);
      }
    },
    [gate, store],
  );

  const open = useCallback((anchor: HistoryAnchor) => void load([anchor]), [load]);

  const older = useCallback(() => {
    const w = store.get(historyAtom);
    const next = w && olderAnchor(w);
    if (w && next) void load(pushAnchor(w.anchors, next));
  }, [store, load]);

  const close = useCallback(() => {
    gate.cancel();
    store.set(historyAtom, null);
    store.set(historyLoadAtom, idle);
  }, [gate, store]);

  const newer = useCallback(() => {
    const w = store.get(historyAtom);
    const anchors = w ? w.anchors.slice(0, -1) : [];
    if (anchors.length) void load(anchors);
    else close();
  }, [store, load, close]);

  return { open, older, newer, close };
}
