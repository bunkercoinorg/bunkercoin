'use client';

import { useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Button, Checkbox, Pagination, Panel, useNow, type PaginationState } from '@bunkercoin/ui';
import { NewRowsBar } from '@bunkercoin/ui/explorer';
import {
  BLOCK_PAGE_SIZE,
  blocksAtom,
  blocksFeedAtom,
  displayCountAtom,
  hasMoreBlocksAtom,
  historyAtom,
  historyLoadAtom,
  isLoadingMoreAtom,
  loadMoreErrorAtom,
  showSkippedSlotsAtom,
} from '@/lib/atoms';
import { CLOCK_MS, coarseAge } from '@/lib/cadence';
import { liveScroll, MAX_RENDERED_ROWS } from '@/lib/chain';
import { olderAnchor } from '@/lib/history';
import { useHistory } from '@/lib/use-history';
import { useLoadOlder } from '@/lib/use-load-older';
import type { Block } from '@/lib/types';
import BlocksTable, { slotLabel } from './blocks-table';

const LABELS = { error: "couldn't load older blocks", end: 'start of chain' };

export default function BlocksPage() {
  const now = useNow(CLOCK_MS);
  const blocks = useAtomValue(blocksAtom);
  const feed = useAtomValue(blocksFeedAtom);
  const hasMore = useAtomValue(hasMoreBlocksAtom);
  const isLoadingMore = useAtomValue(isLoadingMoreAtom);
  const loadMoreError = useAtomValue(loadMoreErrorAtom);
  const [showSkipped, setShowSkipped] = useAtom(showSkippedSlotsAtom);
  const [displayCount, setDisplayCount] = useAtom(displayCountAtom);
  const history = useAtomValue(historyAtom);
  const historyLoad = useAtomValue(historyLoadAtom);
  const pager = useHistory();
  const loadOlder = useLoadOlder();
  // Once older rows are on screen, new head rows wait behind a bar instead of shifting the table.
  const [pinnedHead, setPinnedHead] = useState<number | null>(null);

  const visible = (rows: Block[]) => (showSkipped ? rows : rows.filter((b) => b.type !== 'skip'));
  const filtered = visible(blocks);
  const fresh = pinnedHead === null ? [] : filtered.filter((b) => b.slot > pinnedHead);
  const settled = pinnedHead === null ? filtered : filtered.filter((b) => b.slot <= pinnedHead);
  const liveRows = settled.slice(0, Math.min(displayCount, MAX_RENDERED_ROWS));
  const rows = history ? visible(history.blocks) : liveRows;
  const page = history ? history.blocks : blocks;
  const loading = feed.lastSuccess === null && feed.error === null && blocks.length === 0;
  const action = liveScroll(liveRows.length, settled.length, blocks.length, !hasMore, BLOCK_PAGE_SIZE);

  const pin = () => setPinnedHead((p) => p ?? filtered[0]?.slot ?? null);
  const grow = () => setDisplayCount((n) => Math.min(n + BLOCK_PAGE_SIZE, MAX_RENDERED_ROWS));

  const more = () => {
    if (historyLoad.loading) return;
    if (history) return pager.older();
    pin();
    if (action === 'grow') grow();
    else if (action === 'fetch') void loadOlder().then((ok) => ok && grow());
    else if (action === 'browse') {
      // Every settled row is on screen (or the cap is hit), so skipped tails below the last shown row are seen too.
      const last = liveRows.length < settled.length ? liveRows[liveRows.length - 1] : blocks[blocks.length - 1];
      if (last) pager.open({ cursor: last.slot, estimate: blocks.indexOf(last) + 1 });
    }
  };

  const state: PaginationState = historyLoad.loading
    ? 'loading'
    : historyLoad.error
      ? 'error'
      : history
        ? olderAnchor(history)
          ? 'idle'
          : 'end'
        : isLoadingMore
      ? 'loading'
      : loadMoreError
        ? 'error'
        : action === 'end'
          ? 'end'
          : 'idle';

  const shown = rows.length ? rows : page;
  const range = shown.length ? `${slotLabel(shown[0].slot)} to ${slotLabel(shown[shown.length - 1].slot)}` : '';
  const checked = feed.lastSuccess !== null && now !== null ? `checked ${coarseAge(feed.lastSuccess, now)} ago` : '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="bc-t1 m-0">Blocks.</h1>
        <div className="flex items-center gap-4">
          {history && (
            <Button variant="ghost" size="sm" onClick={pager.newer} disabled={historyLoad.loading}>
              ← newer
            </Button>
          )}
          <Checkbox id="include-skipped" label="include skipped" checked={showSkipped} onChange={setShowSkipped} />
        </div>
      </div>
      <Panel
        flush
        footer={
          page.length > 0 && (
            <Pagination state={state} onMore={more} note={<span className="bc-hint mono">{[range, checked].filter(Boolean).join(' · ')}</span>} labels={LABELS} />
          )
        }
      >
        {history ? (
          <NewRowsBar onShow={pager.close} action="latest">
            older blocks · back to the latest
          </NewRowsBar>
        ) : (
          fresh.length > 0 && (
            <NewRowsBar onShow={() => setPinnedHead(null)}>
              {fresh.length} new {fresh.length === 1 ? 'block' : 'blocks'}
            </NewRowsBar>
          )
        )}
        <BlocksTable blocks={rows} now={now} loading={loading} empty={page.length ? 'All rows here are skipped. Tick include skipped to see them.' : undefined} />
      </Panel>
    </div>
  );
}
