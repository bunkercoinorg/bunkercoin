'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  blocksAtom,
  blocksFeedAtom,
  displayCountAtom,
  hasMoreBlocksAtom,
  highestFinalizedSlotAtom,
  historyAtom,
  historyLoadAtom,
  isLoadingMoreAtom,
  loadMoreErrorAtom,
  selectedBlockHashAtom,
  showSkippedSlotsAtom,
  BLOCK_PAGE_SIZE,
} from '@/lib/atoms';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { Block } from '@/lib/types';
import { liveScroll, MAX_RENDERED_ROWS } from '@/lib/chain';
import { olderAnchor } from '@/lib/history';
import { useHistory } from '@/lib/use-history';

function truncateHash(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function blockTiming(block: Block): string {
  const parts: string[] = [];
  if (block.type === 'block' && block.status === 'finalized' && block.finalized_timestamp) {
    parts.push(`Finalized ${formatDistanceToNow(block.finalized_timestamp, { addSuffix: true })}`);
  }
  if (block.proposed_timestamp) {
    const ago = formatDistanceToNow(block.proposed_timestamp, { addSuffix: true });
    parts.push(block.type === 'block' ? `Proposed ${ago}` : ago);
  }
  return parts.join(', ');
}

function StatusIndicator({ status, type }: { status: string; type: 'block' | 'skip' }) {
  if (type === 'skip') {
    return (
      <div className="flex flex-row sm:flex-row items-center gap-1.5">
        <AlertTriangle size={14} className="text-red-400" />
        <span className="text-xs px-1.5 py-0.5 rounded bg-red-400/20 text-red-400 font-medium w-[70px] text-center">
          skipped
        </span>
      </div>
    );
  }

  if (status === 'finalized') {
    return (
      <div className="flex flex-row sm:flex-row items-center gap-1.5">
        <Check size={14} className="text-white" />
        <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 text-white font-medium w-[70px] text-center">
          {status}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-row sm:flex-row items-center gap-1.5">
      <Loader2 size={14} className="text-white animate-spin" />
      <span className="text-xs px-1.5 py-0.5 rounded bg-white/20 text-white font-medium w-[70px] text-center">
        {status}
      </span>
    </div>
  );
}

export default function BlockList({ onLoadMore }: { onLoadMore: () => Promise<boolean> }) {
  const blocks = useAtomValue(blocksAtom);
  const feed = useAtomValue(blocksFeedAtom);
  const hasMore = useAtomValue(hasMoreBlocksAtom);
  const isLoadingMore = useAtomValue(isLoadingMoreAtom);
  const loadMoreError = useAtomValue(loadMoreErrorAtom);
  const [showSkippedSlots, setShowSkippedSlots] = useAtom(showSkippedSlotsAtom);
  const [displayCount, setDisplayCount] = useAtom(displayCountAtom);
  const highestFinalizedSlot = useAtomValue(highestFinalizedSlotAtom);
  const setSelectedBlockHash = useSetAtom(selectedBlockHashAtom);

  const history = useAtomValue(historyAtom);
  const historyLoad = useAtomValue(historyLoadAtom);
  const pager = useHistory();

  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const [atEnd, setAtEnd] = useState(false);

  const visible = (rows: Block[]) => (showSkippedSlots ? rows : rows.filter((block) => block.type !== 'skip'));
  const filteredBlocks = visible(blocks);
  const liveBlocks = filteredBlocks.slice(0, Math.min(displayCount, MAX_RENDERED_ROWS));
  const displayBlocks = history ? visible(history.blocks) : liveBlocks;
  const loading = feed.lastSuccess === null && feed.error === null && blocks.length === 0;
  const action = liveScroll(liveBlocks.length, filteredBlocks.length, blocks.length, !hasMore, BLOCK_PAGE_SIZE);
  const autoPage = !history && (action === 'grow' || action === 'fetch');

  useEffect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setAtEnd(entry.isIntersecting), {
      threshold: 0.1,
      rootMargin: '100px',
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      setAtEnd(false);
    };
  }, [sentinel]);

  // Re-evaluated after every load, so a page of hidden skips keeps paging.
  useEffect(() => {
    if (!atEnd || !autoPage || isLoadingMore || loading) return;
    if (action === 'grow') setDisplayCount((n) => Math.min(n + BLOCK_PAGE_SIZE, MAX_RENDERED_ROWS));
    else if (!loadMoreError) void onLoadMore();
  }, [atEnd, autoPage, action, isLoadingMore, loading, loadMoreError, filteredBlocks.length, onLoadMore, setDisplayCount]);

  const browseOlder = () => {
    const last = liveBlocks[liveBlocks.length - 1];
    if (last) pager.open({ cursor: last.slot, estimate: blocks.indexOf(last) + 1 });
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold mb-1 tracking-tight">{history ? 'Older Blocks' : 'Recent Blocks'}</h2>
          <p className="text-sm text-muted-foreground">Latest blocks produced by the network. Click them to view details.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-4">
          <label htmlFor="show-skipped" className={`text-sm text-muted-foreground cursor-pointer transition-opacity whitespace-nowrap ${!showSkippedSlots ? 'opacity-60' : 'opacity-100'}`}>
            Show skipped slots
          </label>
          <Switch
            id="show-skipped"
            checked={showSkippedSlots}
            onCheckedChange={setShowSkippedSlots}
          />
        </div>
      </div>
      
      <div className="flex flex-col">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg bg-card/50 backdrop-blur px-4 py-3 flex flex-col gap-1 mb-2">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))
        ) : (
          <>
            {displayBlocks.map((block) => (
              <button
                type="button"
                key={block.slot}
                onClick={() => setSelectedBlockHash(block.hash)}
                className={`group w-full text-left rounded-lg backdrop-blur px-4 py-3 flex items-center justify-between gap-4 hover:bg-card/70 transition-all duration-200 cursor-pointer mb-2 ${
                  block.type === 'skip' 
                    ? 'bg-red-900/10 border border-red-900/20' 
                    : 'bg-card/50'
                }`}
                style={{
                  animation: block.slot === highestFinalizedSlot && displayBlocks.length > 1 && block.type !== 'skip' ? 'slideDown 0.3s ease-out' : undefined
                }}
              >
                <div className="flex flex-col gap-0.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-base">#{block.slot}</span>
                    {block.slot === highestFinalizedSlot && block.type !== 'skip' && (
                      <Badge variant="emerald" className="px-2 py-0 text-[11px] font-semibold">
                        LATEST
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{truncateHash(block.hash)}</span>
                    <div className="flex items-center gap-2">
                      {block.producer !== undefined && (
                        <>
                          <span className="hidden sm:inline opacity-60">•</span>
                          <span>Node {block.producer}</span>
                          <span className="opacity-60">•</span>
                        </>
                      )}
                      <span>{blockTiming(block)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusIndicator status={block.status} type={block.type} />
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-muted-foreground text-xs">→</span>
                  </div>
                </div>
              </button>
            ))}
            
            {autoPage && <div ref={setSentinel} className="h-20" />}

            {isLoadingMore && !history && (
              <div className="flex justify-center py-4">
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <div className="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full" />
                  Loading more blocks...
                </div>
              </div>
            )}

            {loadMoreError && !history && (
              <div className="flex justify-center gap-2 py-4 text-sm text-red-400">
                Could not load older blocks.
                <button type="button" onClick={() => void onLoadMore()} className="underline">
                  Retry
                </button>
              </div>
            )}

            {history ? (
              <div className="flex flex-wrap justify-center gap-4 py-4 text-sm">
                <button type="button" onClick={pager.newer} disabled={historyLoad.loading} className="underline disabled:opacity-50">
                  Newer
                </button>
                {olderAnchor(history) && (
                  <button type="button" onClick={pager.older} disabled={historyLoad.loading} className="underline disabled:opacity-50">
                    Older
                  </button>
                )}
                <button type="button" onClick={pager.close} className="underline">
                  Back to latest
                </button>
              </div>
            ) : action === 'browse' && displayBlocks.length > 0 ? (
              <div className="flex justify-center py-4 text-sm">
                <button type="button" onClick={browseOlder} disabled={historyLoad.loading} className="underline disabled:opacity-50">
                  Browse older blocks
                </button>
              </div>
            ) : null}

            {historyLoad.loading && (
              <div className="flex justify-center py-2 text-sm text-muted-foreground">Loading blocks...</div>
            )}
            {historyLoad.error && (
              <div className="flex justify-center py-2 text-sm text-red-400">Could not load older blocks: {historyLoad.error}</div>
            )}

            {(history ? history.exhausted : action === 'end') && displayBlocks.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No more blocks to load
              </div>
            )}
          </>
        )}
      </div>
      
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
