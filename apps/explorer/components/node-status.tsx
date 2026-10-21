'use client';

import { useAtomValue } from 'jotai';
import { finalizedFlashAtom, nodesAtom, nodesFeedAtom } from '@/lib/atoms';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { useNow } from '@/lib/use-now';

const FLASH_MS = 1000;
// Several missed polls in a row: the validator list can no longer be trusted as current.
const NODES_STALE_MS = 20_000;

export default function NodeStatus() {
  const nodes = useAtomValue(nodesAtom);
  const feed = useAtomValue(nodesFeedAtom);
  const flash = useAtomValue(finalizedFlashAtom);
  const [flashing, setFlashing] = useState<{ seq: number; producers: Set<number> }>({ seq: 0, producers: new Set() });
  const now = useNow();

  useEffect(() => {
    if (!flash.producers.length) return;
    setFlashing({ seq: flash.seq, producers: new Set(flash.producers) });
    const timeout = setTimeout(() => setFlashing((f) => (f.seq === flash.seq ? { ...f, producers: new Set() } : f)), FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  const loading = feed.lastSuccess === null && feed.error === null;
  const stale = feed.lastSuccess === null || feed.error !== null || now - feed.lastSuccess > NODES_STALE_MS;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-1 tracking-tight">Network Validators</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {stale && !loading
          ? 'Validator status is unavailable right now; the slots below are the last ones reported.'
          : "Currently online validators, determining the next block(s) - including the latest blockchain slot they're synced to."}
      </p>
      <div className="flex gap-3">
        {loading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg bg-card/50 backdrop-blur px-4 py-3 flex-1 flex flex-col items-center">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-5 w-12" />
              </div>
            ))
          : nodes.map((node) => (
              <div
                key={node.node_id}
                className={`relative rounded-lg bg-card/50 backdrop-blur px-4 py-3 flex-1
                  flex flex-col items-center transition-all duration-300
                  hover:bg-card/70 hover:scale-105
                  ${flashing.producers.has(node.node_id) ? 'flash-highlight' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="relative flex h-2 w-2">
                    {!stale && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--emerald)] opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${stale ? 'bg-muted-foreground' : 'bg-[color:var(--emerald)]'}`}
                    ></span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Node {node.node_id}</span>
                </div>
                <div className="text-sm sm:text-base md:text-lg font-mono font-bold text-foreground">{node.finalized_slot}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 opacity-80">Finalized</div>
              </div>
            ))}
      </div>
    </section>
  );
}
