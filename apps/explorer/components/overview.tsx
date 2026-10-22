'use client';

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { Link, Panel, StatusTag, useNow } from '@bunkercoin/ui';
import { BlockTimeline, Ledger, Summaries, TransmissionStrip } from '@bunkercoin/ui/explorer';
import {
  archiveAtom,
  archiveReadyAtom,
  blocksAtom,
  blocksFeedAtom,
  highestFinalizedSlotAtom,
  radioBucketsAtom,
  wsStatusAtom,
} from '@/lib/atoms';
import { coveredSpans } from '@/lib/archive';
import { blockTime, cadenceLabel, cadenceSeries, CLOCK_MS, coarseAge, estimateCadence, formatSpan, staleAfter } from '@/lib/cadence';
import { alignedEnd, bucketSamples, kbps, RADIO_BUCKET_MS, RADIO_COLUMNS, RADIO_STALE_MS, stripFrame } from '@/lib/strip';
import { entryLabel, hm, TIMELINE_STEP_MS, timelineCells, timelineSummary, timelineView } from '@/lib/timeline';
import BlocksTable, { slotLabel } from './blocks-table';
import { FEED_STALE_MS, plural, useLatestProducer, useValidators } from './network-panels';
import { PageSearch } from './site-search';

const LATEST_ROWS = 12;
const SPARK_POINTS = 48;

function Strip({ now }: { now: number | null }) {
  const buckets = useAtomValue(radioBucketsAtom);
  const blocks = useAtomValue(blocksAtom);
  const ws = useAtomValue(wsStatusAtom);
  const last = buckets.length ? buckets[buckets.length - 1].at + RADIO_BUCKET_MS : null;
  const live = last !== null && ws === 'open' && now !== null && now - last < RADIO_STALE_MS;
  // Only finished buckets are drawn; a stale strip freezes at its last one.
  const end = live && now !== null ? Math.floor(now / RADIO_BUCKET_MS) * RADIO_BUCKET_MS : last;
  const done = useMemo(() => (end === null ? [] : bucketSamples(buckets.filter((b) => b.at + RADIO_BUCKET_MS <= end))), [buckets, end]);
  const finalized = useMemo(
    () => blocks.flatMap((b) => (b.type === 'block' && b.status === 'finalized' && b.finalized_timestamp ? [{ slot: b.slot, at: b.finalized_timestamp }] : [])),
    [blocks],
  );
  const frame = useMemo(
    () => stripFrame(done, finalized, end ?? 0, RADIO_COLUMNS, RADIO_BUCKET_MS, 'last 30 minutes in 30s means'),
    [done, finalized, end],
  );
  return (
    <TransmissionStrip
      title="radio throughput · 30 min"
      span={['-30m', '-15m']}
      columns={frame.columns}
      summary={frame.summary}
      state={last === null ? 'awaiting' : live ? 'live' : 'stale'}
      staleFor={last !== null && now !== null ? coarseAge(last, now) : undefined}
      peak={frame.peak}
      samples={frame.samples}
    />
  );
}

function History({ now, headAt }: { now: number | null; headAt: number | null }) {
  const archive = useAtomValue(archiveAtom);
  const ready = useAtomValue(archiveReadyAtom);
  const end = now === null ? null : alignedEnd(now, TIMELINE_STEP_MS);
  const cells = useMemo(
    () => (end === null ? [] : timelineCells(archive.blocks, coveredSpans(archive.blocks, headAt), end)),
    [archive.blocks, headAt, end],
  );
  const columns = useMemo(() => timelineView(cells), [cells]);
  const series = useMemo(() => cadenceSeries(archive.blocks, SPARK_POINTS), [archive.blocks]);
  const newest = archive.blocks.find((b) => b.type === 'block' && blockTime(b) !== undefined);
  const made = cells.reduce((n, c) => n + c.entries.filter((e) => !e.skip).length, 0);
  return (
    <BlockTimeline
      title="history · 24 h"
      summary={timelineSummary(cells, 'last 24 hours in 15-minute columns')}
      columns={columns}
      axis={['-24h', '-12h', 'now']}
      phoneAxis={['-12h', '-6h', 'now']}
      meta={<span className="bc-meta">{ready ? plural(made, 'block') : 'loading'}</span>}
      idle={
        newest
          ? `latest · ${entryLabel({ slot: newest.slot, at: blockTime(newest)!, producer: newest.producer, skip: false })} UTC · hover a column for its blocks`
          : 'No finalized blocks in the last 24 hours yet.'
      }
      rows={cells
        .filter((c) => c.entries.length)
        .map((c) => ({ time: `${hm(c.start)}–${hm(c.end)} UTC`, blocks: c.entries.map(entryLabel).join(', ') }))}
      cadence={
        series && {
          points: series.points,
          median: series.cap > 0 ? series.median / series.cap : 0,
          label: `last ${series.points.length} · median ${formatSpan(series.median)}${series.clipped ? ` · ${series.clipped} longer` : ''}`,
        }
      }
    />
  );
}

export default function Overview() {
  const now = useNow(CLOCK_MS);
  const blocks = useAtomValue(blocksAtom);
  const archive = useAtomValue(archiveAtom);
  const feed = useAtomValue(blocksFeedAtom);
  const finalized = useAtomValue(highestFinalizedSlotAtom);
  const buckets = useAtomValue(radioBucketsAtom);
  const validators = useValidators();
  const producer = useLatestProducer();

  const head = blocks.length ? Math.max(...blocks.map((b) => b.slot)) : null;
  const latest = blocks.filter((b) => b.type !== 'skip').slice(0, LATEST_ROWS);
  const loading = feed.lastSuccess === null && feed.error === null && blocks.length === 0;
  const feedStale = feed.error !== null || (feed.lastSuccess !== null && now !== null && now - feed.lastSuccess > FEED_STALE_MS);

  const cadence = useMemo(() => estimateCadence(archive.blocks.length > blocks.length ? archive.blocks : blocks), [archive.blocks, blocks]);
  const lastAt = useMemo(() => {
    const b = blocks.find((x) => x.type === 'block' && x.status === 'finalized' && blockTime(x) !== undefined);
    return b ? blockTime(b)! : null;
  }, [blocks]);
  const quiet = lastAt !== null && now !== null && now - lastAt > staleAfter(cadence);
  // The archive reaches the present only while the feed is current and it holds the finalized head.
  const headAt = !feedStale && feed.lastSuccess !== null && archive.blocks[0]?.slot === finalized ? feed.lastSuccess : null;

  const lastBlock =
    lastAt === null ? (
      <StatusTag status={feed.error ? 'offline' : 'awaiting'} />
    ) : (
      <>
        {now === null ? '–' : `${coarseAge(lastAt, now)} ago`}{' '}
        <StatusTag status={feedStale || quiet ? 'stale' : 'live'} detail={!feedStale && quiet ? 'quiet' : undefined} className="ml-1.5" />
      </>
    );

  const done = now === null ? [] : buckets.filter((b) => b.at + RADIO_BUCKET_MS <= now);
  const lastBucket = done.length ? done[done.length - 1] : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="bc-t1 m-0">Explorer.</h1>
          <Link className="bc-pill" href="/stream">
            <i aria-hidden="true" />
            watch lab live stream
          </Link>
        </div>
        <PageSearch />
      </div>
      <Ledger
        row
        items={[
          { label: 'latest slot', value: head === null ? '–' : slotLabel(head) },
          { label: 'finalized', value: finalized === null ? '–' : slotLabel(finalized) },
          { label: 'cadence', value: cadence === null ? '–' : cadenceLabel(cadence) },
          { label: 'last block', value: lastBlock },
        ]}
      />
      <History now={now} headAt={headAt} />
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
      <Strip now={now} />
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
            value: lastBucket ? `${kbps(lastBucket.sum / lastBucket.n)} · 30s mean` : 'awaiting first sample',
            sub: lastBucket && now !== null ? `${coarseAge(lastBucket.at + RADIO_BUCKET_MS, now)} ago →` : 'network →',
            href: '/network#radio',
          },
          { label: 'lab camera', value: 'watch camera', sub: '/stream ↗', href: '/stream' },
        ]}
      />
    </div>
  );
}
