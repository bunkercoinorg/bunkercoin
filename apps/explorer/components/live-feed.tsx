'use client';

import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { utcClock } from '@bunkercoin/chain-format';
import { Banner, Button, StatusTag } from '@bunkercoin/ui';
import {
  applyChainAtom,
  BLOCK_PAGE_SIZE,
  blocksFeedAtom,
  loadMoreErrorAtom,
  nodesAtom,
  nodesFeedAtom,
  wsStatusAtom,
} from '@/lib/atoms';
import { api, errorMessage, isAbort } from '@/lib/api';
import { applyHead } from '@/lib/chain';
import { usePoll } from '@/lib/use-poll';
import { useArchive } from '@/lib/use-archive';
import { useWebSocket } from '@/lib/websocket';

// Live slots arrive over the socket; polling then only reconciles. Blocks take minutes over radio.
export const POLL_MS_WS_HEALTHY = 30_000;
const POLL_MS_WS_DOWN = 15_000;

/** Keeps the shared chain view, validators and radio feed current; renders the API-offline bar. */
export default function LiveFeed() {
  const applyChain = useSetAtom(applyChainAtom);
  const setBlocksFeed = useSetAtom(blocksFeedAtom);
  const setNodesFeed = useSetAtom(nodesFeedAtom);
  const setNodes = useSetAtom(nodesAtom);
  const setLoadMoreError = useSetAtom(loadMoreErrorAtom);
  const wsStatus = useAtomValue(wsStatusAtom);
  const blocks = useAtomValue(blocksFeedAtom);
  const nodes = useAtomValue(nodesFeedAtom);

  useWebSocket();
  useArchive();

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
      const list = await api.getNodes({ signal });
      if (signal.aborted) return;
      setNodes(list);
      setNodesFeed({ lastSuccess: Date.now(), error: null });
    } catch (e) {
      if (!isAbort(e)) setNodesFeed((f) => ({ ...f, error: errorMessage(e) }));
    }
  }, interval);

  const retry = useCallback(() => {
    pollBlocks();
    pollNodes();
  }, [pollBlocks, pollNodes]);

  if (!(blocks.error ?? nodes.error)) return null;
  return (
    <Banner
      tone="danger"
      action={
        <Button variant="ghost" size="sm" onClick={retry}>
          retry
        </Button>
      }
    >
      <span className="bc-row">
        <StatusTag status="offline" />
        <span className="bc-small">
          Can&apos;t reach the explorer API.{blocks.lastSuccess !== null && ` Data from ${utcClock(blocks.lastSuccess)}.`}
        </span>
      </span>
    </Banner>
  );
}
