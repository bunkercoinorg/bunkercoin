'use client';

import { useCallback, useRef } from 'react';
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
import { applyHead, applyOlder, cursorSlot, fetchOlderThan } from '@/lib/chain';
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
  const loadingOlder = useRef(false);

  useWebSocket();

  const interval = wsStatus === 'open' ? POLL_MS_WS_HEALTHY : POLL_MS_WS_DOWN;

  const pollBlocks = usePoll(async (signal) => {
    try {
      const page = await api.getBlocks(0, BLOCK_PAGE_SIZE, { signal });
      if (signal.aborted) return;
      applyChain((view, retain) => applyHead(view, page, BLOCK_PAGE_SIZE, retain));
      setBlocksFeed({ lastSuccess: Date.now(), error: null });
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

  // Resolves true once older rows (or the end of history) were merged.
  const loadOlder = useCallback(async (): Promise<boolean> => {
    const view = store.get(chainAtom);
    const cursor = cursorSlot(view);
    if (loadingOlder.current || cursor === null || view.exhausted) return false;
    loadingOlder.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const older = await fetchOlderThan(cursor, view.blocks.length, BLOCK_PAGE_SIZE, (offset, limit) =>
        api.getBlocks(offset, limit),
      );
      // The head may have reset or the cap moved the cursor meanwhile.
      if (cursorSlot(store.get(chainAtom)) !== cursor) return false;
      applyChain((v, retain) => applyOlder(v, older.blocks, older.exhausted, retain));
      return true;
    } catch (e) {
      setLoadMoreError(errorMessage(e));
      return false;
    } finally {
      loadingOlder.current = false;
      setLoadingMore(false);
    }
  }, [store, applyChain, setLoadingMore, setLoadMoreError]);

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
