'use client';

import { stringifyJson, utcClock } from '@bunkercoin/chain-format';
import { BackLink, ButtonLink, CopyValue, Disclosure, Facts, formatDuration, Link, PageIntro, StatusTag, TimeValue, useNow, type Fact } from '@bunkercoin/ui';
import { blockStatus, slotLabel } from '@/components/blocks-table';
import { DetailGate, latestSeen, RefreshState, useHeadSlot } from '@/components/detail';
import { useQueryParam } from '@/lib/use-query-param';
import { useEntity } from '@/lib/use-entity';
import { api } from '@/lib/api';
import { routes } from '@/lib/routes';
import { CLOCK_MS, coarseAge } from '@/lib/cadence';
import type { Block } from '@/lib/types';

const PENDING_POLL_MS = 5000;
const pollUntilFinal = (b: Block | null) => (b && b.status !== 'finalized' ? PENDING_POLL_MS : null);

function BlockView({ block, entity }: { block: Block; entity: Parameters<typeof RefreshState>[0]['entity'] }) {
  const now = useNow(CLOCK_MS);
  const skipped = block.type === 'skip';
  const nav = (
    <div className="flex gap-2">
      {block.slot > 0 && (
        <ButtonLink variant="ghost" size="sm" href={routes.block(block.slot - 1)}>
          ← {slotLabel(block.slot - 1)}
        </ButtonLink>
      )}
      <ButtonLink variant="ghost" size="sm" href={routes.block(block.slot + 1)}>
        {slotLabel(block.slot + 1)} →
      </ButtonLink>
    </div>
  );
  if (skipped) {
    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageIntro title={`Slot ${slotLabel(block.slot)} was skipped.`} lead="No block was produced. Validators certified the skip." />
          {nav}
        </div>
        <Facts
          columns={3}
          items={[
            { label: 'certificate hash', value: <CopyValue value={block.hash} mode="full" label="certificate hash" />, wide: true },
            ...(block.proposed_timestamp ? [{ label: 'recorded', value: <TimeValue ms={block.proposed_timestamp} /> }] : []),
          ]}
        />
        <RefreshState entity={entity} />
      </>
    );
  }
  const proposed = block.proposed_timestamp;
  const finalized = block.status === 'finalized' ? block.finalized_timestamp : undefined;
  const key: Fact[] = [
    { label: 'producer', value: block.producer === undefined ? '–' : `node ${block.producer}` },
    {
      label: 'proposed',
      value: proposed ? (
        <>
          <TimeValue ms={proposed} />
          {now !== null && ` · ${coarseAge(proposed, now)} ago`}
        </>
      ) : (
        '–'
      ),
    },
    {
      label: 'finalized',
      value: finalized ? (
        <>
          {utcClock(finalized)}
          {proposed && <span className="bc-s"> · +{formatDuration(finalized - proposed)}</span>}
        </>
      ) : proposed && now !== null ? (
        `${block.status} for ${coarseAge(proposed, now)}`
      ) : (
        '–'
      ),
    },
    { label: 'hash', value: <CopyValue value={block.hash} mode="full" label="block hash" />, wide: true },
  ];
  const more: Fact[] = [
    ...(block.parent_slot !== undefined
      ? [{ label: 'parent', value: <Link className="bc-lnk" href={routes.block(block.parent_slot)}>{slotLabel(block.parent_slot)}</Link> }]
      : []),
    ...(entity.refreshError ? [] : [{ label: 'checked', value: <RefreshState entity={entity} /> }]),
    ...(block.parent_hash ? [{ label: 'parent hash', value: <CopyValue value={block.parent_hash} mode="full" label="parent hash" />, wide: true }] : []),
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="bc-t1 m-0">Block {slotLabel(block.slot)}.</h1>
          <StatusTag status={blockStatus(block)} />
          {entity.refreshError && <RefreshState entity={entity} />}
        </div>
        {nav}
      </div>
      <Facts columns={3} items={key} />
      <Disclosure summary="details">
        <div className="flex flex-col gap-3">
          <Facts columns={3} items={more} />
          <pre className="term m-0">{stringifyJson(block)}</pre>
        </div>
      </Disclosure>
    </>
  );
}

export default function BlockPage() {
  const id = useQueryParam('id');
  const head = useHeadSlot();
  const entity = useEntity(id, (key, signal) => api.getBlockById(key, { signal }), pollUntilFinal);
  const bySlot = !!id && /^\d+$/.test(id);
  return (
    <DetailGate
      entity={entity}
      id={id}
      what="block"
      back={<BackLink label="blocks" href="/blocks" />}
      missing="Search for a slot or hash."
      unavailable={`Block ${id ?? ''} unavailable.`}
      notFound={{
        title: bySlot ? `No block at slot ${slotLabel(id)}.` : 'No block with this hash.',
        message: `${latestSeen(head)}Radio delivery can take minutes.`,
      }}
    >
      {(block) => <BlockView block={block} entity={entity} />}
    </DetailGate>
  );
}
