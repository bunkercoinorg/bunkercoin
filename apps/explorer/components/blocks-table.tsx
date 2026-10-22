'use client';

import { useEffect, useRef } from 'react';
import { formatInteger, shortId, utcClock } from '@bunkercoin/chain-format';
import { CopyValue, StatusTag, type Status } from '@bunkercoin/ui';
import { DataTable, type Column } from '@bunkercoin/ui/explorer';
import { blockTime, coarseAge } from '@/lib/cadence';
import { routes } from '@/lib/routes';
import type { Block } from '@/lib/types';

export const blockStatus = (b: Block): Status => (b.type === 'skip' ? 'skipped' : b.status);
export const slotLabel = (slot: number | string) => formatInteger(BigInt(slot));
// A reload after a long absence lands many rows at once; only a trickle washes.
const MAX_WASHED = 2;

function Age({ block, now }: { block: Block; now: number | null }) {
  const at = blockTime(block);
  if (at === undefined || now === null) return <span className="bc-hint mono">–</span>;
  return (
    <time className="mono" dateTime={new Date(at).toISOString()} title={utcClock(at)}>
      {coarseAge(at, now)}
    </time>
  );
}

const COLUMNS = (now: number | null): Column<Block>[] => [
  { key: 'slot', header: 'slot', cell: (b) => <span className="mono">{slotLabel(b.slot)}</span> },
  { key: 'state', header: 'state', cell: (b) => <StatusTag status={blockStatus(b)} /> },
  {
    key: 'hash',
    header: 'hash',
    cell: (b) => (b.type === 'skip' ? <span className="bc-hint mono">skip certificate</span> : <CopyValue value={b.hash} label="block hash" />),
  },
  { key: 'producer', header: 'producer', cell: (b) => <span className="mono">{b.producer === undefined ? '–' : `node ${b.producer}`}</span> },
  { key: 'age', header: 'age', align: 'right', cell: (b) => <Age block={b} now={now} /> },
];

/** E02 table; phones get one linked record per block. New head rows wash once. */
export default function BlocksTable({
  blocks,
  now,
  caption = 'blocks',
  loading,
  empty = 'No blocks received yet.',
}: {
  blocks: Block[];
  now: number | null;
  caption?: string;
  loading?: boolean;
  empty?: string;
}) {
  // Only slots above the highest one seen so far are new head rows; revealed older rows never wash.
  const top = useRef<number | null>(null);
  const known = top.current;
  const fresh = known === null ? 0 : blocks.filter((b) => b.slot > known).length;
  useEffect(() => {
    if (blocks.length) top.current = Math.max(top.current ?? -1, ...blocks.map((b) => b.slot));
  }, [blocks]);
  return (
    <DataTable
      caption={caption}
      columns={COLUMNS(now)}
      rows={blocks}
      rowKey={(b) => String(b.slot)}
      rowHref={(b) => routes.block(b.slot)}
      rowState={(b) => ({ isNew: fresh <= MAX_WASHED && known !== null && b.slot > known, dim: b.type === 'skip' })}
      phone={(b) => (
        <>
          <span className="flex items-center gap-2.5">
            <span className="mono">{slotLabel(b.slot)}</span>
            <StatusTag status={blockStatus(b)} />
          </span>
          <span className="bc-hint mono block">
            {b.type === 'skip' ? 'skip certificate' : shortId(b.hash)}
            {b.producer !== undefined && ` · node ${b.producer}`}
          </span>
          <span className="bc-hint block">
            <Age block={b} now={now} />
          </span>
        </>
      )}
      state={loading ? 'loading' : 'ready'}
      loadingLabel="listening for blocks…"
      empty={empty}
    />
  );
}
