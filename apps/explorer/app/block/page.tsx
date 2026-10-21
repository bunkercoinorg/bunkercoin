'use client';

import { formatDistanceToNow } from 'date-fns';
import Header from '@/components/header';
import { EntityPage, DetailRow, HashLink, StatusPill, NotFoundCard, ErrorCard, Loading } from '@/components/explorer-ui';
import { useQueryParam } from '@/lib/use-query-param';
import { useEntity } from '@/lib/use-entity';
import { api } from '@/lib/api';
import { routes } from '@/lib/routes';
import type { Block } from '@/lib/types';

const PENDING_POLL_MS = 5000;
const pollUntilFinal = (b: Block | null) => (b && b.status !== 'finalized' ? PENDING_POLL_MS : null);

export default function BlockPage() {
  const id = useQueryParam('id');
  const { status, data: block, error, retry } = useEntity(id, (key, signal) => api.getBlockById(key, { signal }), pollUntilFinal);

  const ts = block?.finalized_timestamp ?? block?.proposed_timestamp;

  return (
    <>
      <Header />
      <EntityPage title={`Block${block ? ` #${block.slot}` : ''}`}>
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <ErrorCard message={error ?? 'Could not load the block.'} onRetry={retry} />
        ) : !block ? (
          <NotFoundCard what="block" id={id ?? ''} />
        ) : (
          <div className="rounded-lg border border-border/60 bg-card px-5">
            <DetailRow label="Slot">{block.slot}</DetailRow>
            <DetailRow label="Status">
              {block.status === 'finalized' ? (
                <StatusPill tone="success">finalized</StatusPill>
              ) : (
                <StatusPill tone="pending">{block.status}</StatusPill>
              )}
            </DetailRow>
            <DetailRow label="Hash">
              <HashLink value={block.hash} truncateTo={false} />
            </DetailRow>
            {block.producer !== undefined ? (
              <DetailRow label="Producer">Node {block.producer}</DetailRow>
            ) : null}
            {block.parent_slot !== undefined ? (
              <DetailRow label="Parent">
                <HashLink value={`slot ${block.parent_slot}`} href={routes.block(block.parent_slot)} truncateTo={false} />
              </DetailRow>
            ) : null}
            {block.parent_hash ? (
              <DetailRow label="Parent hash">
                <HashLink value={block.parent_hash} href={routes.block(block.parent_hash)} />
              </DetailRow>
            ) : null}
            {ts ? (
              <DetailRow label="Time">
                {new Date(ts).toLocaleString()}{' '}
                <span className="text-muted-foreground">({formatDistanceToNow(ts, { addSuffix: true })})</span>
              </DetailRow>
            ) : null}
          </div>
        )}
      </EntityPage>
    </>
  );
}
