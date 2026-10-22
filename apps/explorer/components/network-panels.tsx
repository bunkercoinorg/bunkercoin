'use client';

import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { relativeAge } from '@bunkercoin/chain-format';
import { Cell, Cells, Disclosure, EmptyState, Facts, Freshness, Panel, Skeleton, StatusTag, useNow } from '@bunkercoin/ui';
import { blocksAtom, finalizedFlashAtom, nodesAtom, nodesFeedAtom, radioStatsAtom, wsStatusAtom } from '@/lib/atoms';
import { CLOCK_MS } from '@/lib/cadence';
import { kbps, RADIO_STALE_MS } from '@/lib/strip';
import { slotLabel } from './blocks-table';
import type { RadioStats } from '@/lib/types';

// Three missed reconciling polls.
export const FEED_STALE_MS = 90_000;
const FLASH_MS = 1000;
const RETRY_DANGER = 0.25;

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
const kib = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`);

/** The producer of the newest produced block, if the chain view has one. */
export function useLatestProducer(): number | undefined {
  const blocks = useAtomValue(blocksAtom);
  return blocks.find((b) => b.type === 'block' && b.producer !== undefined)?.producer;
}

export function useValidators() {
  const nodes = useAtomValue(nodesAtom);
  const feed = useAtomValue(nodesFeedAtom);
  const max = nodes.length ? Math.max(...nodes.map((n) => n.finalized_slot)) : null;
  const min = nodes.length ? Math.min(...nodes.map((n) => n.finalized_slot)) : null;
  return { nodes, feed, max, lag: max !== null && min !== null ? max - min : null };
}

export type RadioView = { stats: RadioStats | null; live: boolean; now: number | null };

export function useRadio(): RadioView {
  const stats = useAtomValue(radioStatsAtom);
  const ws = useAtomValue(wsStatusAtom);
  const now = useNow(CLOCK_MS);
  // Socket open alone is not live: the last sample has to be recent.
  const live = stats !== null && ws === 'open' && now !== null && now - stats.received_at < RADIO_STALE_MS;
  return { stats, live, now };
}

export function radioAge({ stats, live, now }: RadioView) {
  if (!stats) return <StatusTag status="awaiting" />;
  if (now === null) return null;
  const age = relativeAge(stats.received_at, now);
  return live ? <span className="bc-hint mono">{age} ago</span> : <StatusTag status="stale" detail={age} />;
}

export function ValidatorsPanel() {
  const { nodes, feed, max } = useValidators();
  const producer = useLatestProducer();
  const flash = useAtomValue(finalizedFlashAtom);
  const now = useNow(CLOCK_MS);
  const [flashing, setFlashing] = useState<{ seq: number; producers: Set<number> }>({ seq: 0, producers: new Set() });

  useEffect(() => {
    if (!flash.producers.length) return;
    setFlashing({ seq: flash.seq, producers: new Set(flash.producers) });
    const timeout = setTimeout(() => setFlashing((f) => (f.seq === flash.seq ? { ...f, producers: new Set() } : f)), FLASH_MS);
    return () => clearTimeout(timeout);
  }, [flash]);

  const loading = feed.lastSuccess === null && feed.error === null;
  return (
    <Panel title="validators" meta={!loading && <Freshness lastSuccessAt={feed.lastSuccess} staleAfterMs={FEED_STALE_MS} now={now ?? undefined} />} flush>
      {loading ? (
        <Skeleton rows={2} columns={2} label="loading validators…" />
      ) : nodes.length === 0 ? (
        <EmptyState>{feed.error ? 'Validators unavailable.' : 'No validators reported yet.'}</EmptyState>
      ) : (
        <Cells columns={2}>
          {nodes.map((n) => {
            const behind = max === null ? 0 : max - n.finalized_slot;
            return (
              <Cell key={n.node_id} isNew={flashing.producers.has(n.node_id)}>
                <span className="bc-lbl">
                  node {n.node_id} {n.node_id === producer && <StatusTag status="producer" className="ml-1.5" />}
                </span>
                <span className="bc-big">{slotLabel(n.finalized_slot)}</span>
                <span className="bc-hint mono" title="behind the highest finalized slot reported">
                  {plural(behind, 'slot')} behind
                </span>
              </Cell>
            );
          })}
        </Cells>
      )}
    </Panel>
  );
}

export function RadioPanel() {
  const radio = useRadio();
  const { stats } = radio;
  return (
    <Panel title="radio link · 30s" meta={radioAge(radio)}>
      {!stats ? (
        <p className="bc-hint">Rolling 30s window, sampled every 2s. No sample yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Facts
            columns={2}
            phoneColumns={2}
            items={[
              { label: 'throughput', value: kbps(stats.effective_throughput_bps_2s) },
              {
                label: 'retry rate',
                value: (
                  <>
                    <span className={stats.packet_loss_rate_2s > RETRY_DANGER ? 'text-danger' : undefined}>{percent(stats.packet_loss_rate_2s)}</span>{' '}
                    <span className="bc-s">
                      {stats.packets_dropped_2s} / {stats.packets_transmitted_2s}
                    </span>
                  </>
                ),
              },
            ]}
          />
          <Disclosure summary="details">
            <Facts
              columns={3}
              phoneColumns={2}
              items={[
                { label: 'frames', value: stats.packets_sent_2s },
                { label: 'queued', value: stats.packets_queued },
                { label: 'pactor', value: stats.link_speed_level === 0 ? 'not reported' : stats.link_speed_level },
                { label: 'bytes tx', value: kib(stats.bytes_transmitted_2s) },
                { label: 'bytes rx', value: kib(stats.bytes_received_2s) },
              ]}
            />
          </Disclosure>
        </div>
      )}
    </Panel>
  );
}

export const radioSummary = (stats: RadioStats) => `${kbps(stats.effective_throughput_bps_2s)} · retry ${percent(stats.packet_loss_rate_2s)}`;
export { plural };
