'use client';

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { relativeAge } from '@bunkercoin/chain-format';
import { ButtonLink, Link, Panel, StatusTag, useNow } from '@bunkercoin/ui';
import { Ledger, Summaries, TransmissionStrip } from '@bunkercoin/ui/explorer';
import { blocksAtom, blocksFeedAtom, highestFinalizedSlotAtom, radioSamplesAtom, wsStatusAtom } from '@/lib/atoms';
import { RADIO_STALE_MS, stripFrame } from '@/lib/strip';
import BlocksTable, { slotLabel } from './blocks-table';
import { FEED_STALE_MS, plural, radioSummary, useLatestProducer, useRadio, useValidators } from './network-panels';
import { PageSearch } from './site-search';

const LATEST_ROWS = 6;

function Strip({ now }: { now: number | null }) {
  const samples = useAtomValue(radioSamplesAtom);
  const blocks = useAtomValue(blocksAtom);
  const ws = useAtomValue(wsStatusAtom);
  const last = samples.length ? samples[samples.length - 1].at : null;
  const live = last !== null && ws === 'open' && now !== null && now - last < RADIO_STALE_MS;
  // A stale strip freezes at its last sample: no new columns without data.
  const end = live ? now : last;
  const finalized = useMemo(
    () => blocks.flatMap((b) => (b.type === 'block' && b.status === 'finalized' && b.finalized_timestamp ? [{ slot: b.slot, at: b.finalized_timestamp }] : [])),
    [blocks],
  );
  const frame = end === null ? stripFrame([], [], 0) : stripFrame(samples, finalized, end);
  return (
    <TransmissionStrip
      columns={frame.columns}
      summary={frame.summary}
      state={last === null ? 'awaiting' : live ? 'live' : 'stale'}
      staleFor={last !== null && now !== null ? relativeAge(last, now) : undefined}
      peak={frame.peak}
      samples={frame.samples}
    />
  );
}

export default function Overview() {
  const now = useNow();
  const blocks = useAtomValue(blocksAtom);
  const feed = useAtomValue(blocksFeedAtom);
  const finalized = useAtomValue(highestFinalizedSlotAtom);
  const validators = useValidators();
  const producer = useLatestProducer();
  const radio = useRadio();

  const head = blocks.length ? Math.max(...blocks.map((b) => b.slot)) : null;
  const latest = blocks.filter((b) => b.type !== 'skip').slice(0, LATEST_ROWS);
  const loading = feed.lastSuccess === null && feed.error === null && blocks.length === 0;
  const stale = feed.error !== null || (feed.lastSuccess !== null && now !== null && now - feed.lastSuccess > FEED_STALE_MS);

  const checked =
    feed.lastSuccess === null ? (
      <StatusTag status={feed.error ? 'offline' : 'awaiting'} />
    ) : (
      <>
        {now === null ? '–' : `${relativeAge(feed.lastSuccess, now)} ago`} <StatusTag status={stale ? 'stale' : 'live'} className="ml-1.5" />
      </>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <h1 className="bc-t1 m-0">Explorer.</h1>
          <ButtonLink href="/stream" variant="ghost">
            watch lab live stream
          </ButtonLink>
        </div>
        <PageSearch />
      </div>
      <Ledger
        row
        items={[
          { label: 'latest slot', value: head === null ? '–' : slotLabel(head) },
          { label: 'finalized', value: finalized === null ? '–' : slotLabel(finalized) },
          { label: 'checked', value: checked },
        ]}
      />
      <Strip now={now} />
      <Panel
        title="latest blocks"
        actions={
          <Link className="bc-mini" href="/blocks">
            all blocks →
          </Link>
        }
        flush
      >
        <BlocksTable blocks={latest} now={now} caption="latest blocks" loading={loading} />
      </Panel>
      <Summaries
        items={[
          {
            label: 'validators',
            value: validators.nodes.length
              ? `${validators.nodes.length} reporting · max lag ${plural(validators.lag ?? 0, 'slot')}`
              : validators.feed.error
                ? 'unavailable'
                : 'none reported yet',
            sub: producer === undefined ? 'network →' : `producer node ${producer} →`,
            href: '/network',
          },
          {
            label: 'radio link',
            value: radio.stats ? radioSummary(radio.stats) : 'awaiting first sample',
            sub: radio.stats && now !== null ? `${radio.live ? 'sampled' : 'stale ·'} ${relativeAge(radio.stats.received_at, now)} ago →` : 'network →',
            href: '/network#radio',
          },
          { label: 'lab camera', value: 'watch camera', sub: '/stream ↗', href: '/stream' },
        ]}
      />
    </div>
  );
}
