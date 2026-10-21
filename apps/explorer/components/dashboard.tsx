'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import {
  applyChainAtom,
  BLOCK_PAGE_SIZE,
  blocksFeedAtom,
  chainAtom,
  isLoadingMoreAtom,
  loadMoreErrorAtom,
  nodesAtom,
  nodesFeedAtom,
  wsStatusAtom,
} from '@/lib/atoms';
import { api, errorMessage, isAbort } from '@/lib/api';
import { applyHead, applyOlder, cursorSlot, fetchOlderThan, MAX_RETAINED_BLOCKS } from '@/lib/chain';
import { createGate } from '@/lib/request-gate';
import { usePoll } from '@/lib/use-poll';
import { useWebSocket } from '@/lib/websocket';
import NodeStatus from './node-status';
import NetworkStats from './network-stats';
import BlockList from './block-list';
import SearchBar from './search-bar';
import BlockDetailsDialog from './block-details-dialog';
import LivestreamPanel from './livestream-panel';
import FeedBanner from './feed-banner';

// Live slots arrive over the socket; polling then only reconciles.
const POLL_MS_WS_HEALTHY = 5000;
const POLL_MS_WS_DOWN = 2000;

export default function Dashboard() {
  const store = useStore();
  const applyChain = useSetAtom(applyChainAtom);
  const setBlocksFeed = useSetAtom(blocksFeedAtom);
  const setNodesFeed = useSetAtom(nodesFeedAtom);
  const setNodes = useSetAtom(nodesAtom);
  const setLoadingMore = useSetAtom(isLoadingMoreAtom);
  const setLoadMoreError = useSetAtom(loadMoreErrorAtom);
  const wsStatus = useAtomValue(wsStatusAtom);
  const [olderGate] = useState(createGate);

  useWebSocket();

  const interval = wsStatus === 'open' ? POLL_MS_WS_HEALTHY : POLL_MS_WS_DOWN;

  const pollBlocks = usePoll(async (signal) => {
    try {
      const page = await api.getBlocks(0, BLOCK_PAGE_SIZE, { signal });
      if (signal.aborted) return;
      applyChain((view) => applyHead(view, page, BLOCK_PAGE_SIZE));
      setBlocksFeed({ lastSuccess: Date.now(), error: null });
      setLoadMoreError(null);
    } catch (e) {
      if (!isAbort(e)) setBlocksFeed((f) => ({ ...f, error: errorMessage(e) }));
    }
  }, interval);

  const pollNodes = usePoll(async (signal) => {
    try {
      const nodes = await api.getNodes({ signal });
      if (signal.aborted) return;
      setNodes(nodes);
      setNodesFeed({ lastSuccess: Date.now(), error: null });
    } catch (e) {
      if (!isAbort(e)) setNodesFeed((f) => ({ ...f, error: errorMessage(e) }));
    }
  }, interval);

  const retry = useCallback(() => {
    pollBlocks();
    pollNodes();
  }, [pollBlocks, pollNodes]);

  useEffect(
    () => () => {
      olderGate.cancel();
      setLoadingMore(false);
    },
    [olderGate, setLoadingMore],
  );

  // Resolves true once older rows (or the end of history) were merged.
  const loadOlder = useCallback(async (): Promise<boolean> => {
    const view = store.get(chainAtom);
    const cursor = cursorSlot(view);
    if (olderGate.busy() || cursor === null || view.exhausted) return false;
    if (view.blocks.length + BLOCK_PAGE_SIZE > MAX_RETAINED_BLOCKS) return false;
    const ticket = olderGate.begin();
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
      olderGate.finish(ticket);
    }
  }, [store, olderGate, applyChain, setLoadingMore, setLoadMoreError]);

  return (
    <>
      <div className="w-full flex flex-col items-center px-4 sm:px-0 py-8">
        <div className="w-full max-w-3xl">
          <div className="mb-6">
            <SearchBar />
          </div>
          <FeedBanner onRetry={retry} />
          <NodeStatus />
          <NetworkStats />
          <LivestreamPanel />
          <BlockList onLoadMore={loadOlder} />
        </div>
      </div>
      <BlockDetailsDialog />
    </>
  );
}
