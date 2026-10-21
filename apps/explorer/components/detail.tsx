'use client';

import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { relativeAge, utcClock } from '@bunkercoin/chain-format';
import { Button, ButtonLink, Skeleton, StatePanel, StatusTag, useNow } from '@bunkercoin/ui';
import { blocksAtom } from '@/lib/atoms';
import type { EntityState } from '@/lib/use-entity';
import { slotLabel } from './blocks-table';
import { searchPath } from './site-search';

export const unreachable = (error: string | null) =>
  !error || /unreachable/i.test(error) ? "Can't reach the explorer API." : error;

export function useHeadSlot(): number | null {
  const blocks = useAtomValue(blocksAtom);
  return blocks.length ? Math.max(...blocks.map((b) => b.slot)) : null;
}

/** Everything a detail page shows before it has a record: missing id, loading, unavailable, confirmed 404. */
export function DetailGate<T>({
  entity,
  id,
  back,
  what,
  missing,
  unavailable,
  notFound,
  children,
}: {
  entity: EntityState<T>;
  id: string | undefined;
  back: ReactNode;
  what: string;
  missing: string;
  unavailable: string;
  notFound: { title: string; message: ReactNode };
  children: (data: T) => ReactNode;
}) {
  const head = useHeadSlot();
  let body: ReactNode;
  if (entity.status === 'idle') {
    body = (
      <StatePanel heading="h1" state="missing" title={`No ${what} id in the address.`} message={missing} actions={<ButtonLink variant="ghost" href="/search">search</ButtonLink>} />
    );
  } else if (entity.status === 'loading') {
    body = <Skeleton rows={4} columns={3} label={`loading ${what}…`} />;
  } else if (entity.status === 'error') {
    body = (
      <StatePanel
        heading="h1"
        state="error"
        title={unavailable}
        message={unreachable(entity.error)}
        actions={
          <>
            <Button variant="primary" onClick={entity.retry}>
              retry
            </Button>
            <ButtonLink variant="ghost" href={searchPath(id ?? '')}>
              edit search
            </ButtonLink>
          </>
        }
      />
    );
  } else if (entity.data === null) {
    body = (
      <StatePanel
        heading="h1"
        state="notfound"
        title={notFound.title}
        message={notFound.message}
        actions={
          <>
            {head !== null && (
              <ButtonLink variant="primary" href={`/block?id=${head}`}>
                latest block
              </ButtonLink>
            )}
            <ButtonLink variant="ghost" href={searchPath(id ?? '')}>
              search again
            </ButtonLink>
          </>
        }
      />
    );
  } else {
    body = children(entity.data);
  }
  return (
    <div className="flex flex-col gap-6">
      {back}
      {body}
    </div>
  );
}

export const latestSeen = (head: number | null) => (head === null ? '' : `Latest slot seen: ${slotLabel(head)}. `);

/** A failed refresh keeps the record: `stale · last checked 21:04:30 UTC` + retry. */
export function RefreshState({ entity }: { entity: EntityState<unknown> }) {
  const now = useNow();
  if (entity.lastSuccess === null) return null;
  if (!entity.refreshError) {
    return <span className="bc-hint mono">checked {now === null ? '' : `${relativeAge(entity.lastSuccess, now)} ago`}</span>;
  }
  return (
    <span className="bc-row">
      <StatusTag status="stale" detail={`last checked ${utcClock(entity.lastSuccess)}`} />
      <Button variant="ghost" size="sm" onClick={entity.retry}>
        retry
      </Button>
    </span>
  );
}
