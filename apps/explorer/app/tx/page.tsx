'use client';

import Header from '@/components/header';
import {
  EntityPage,
  DetailRow,
  HashLink,
  StatusPill,
  NotFoundCard,
  ErrorCard,
  Loading,
  RefreshNotice,
} from '@/components/explorer-ui';
import { useQueryParam } from '@/lib/use-query-param';
import { useEntity } from '@/lib/use-entity';
import { api } from '@/lib/api';
import { normalizeHash, normalizeTokenId, toBase58 } from '@/lib/codec';
import { formatBunker, formatInteger } from '@/lib/amount';
import { routes } from '@/lib/routes';
import { TransactionDetails } from '@/lib/types';

// Until final, keep refreshing; a missing tx may still be propagating over radio.
const PENDING_POLL_MS = 5000;
const NOT_FOUND_POLL_MS = 15_000;
const pollUntilFinal = (tx: TransactionDetails | null) =>
  tx === null ? NOT_FOUND_POLL_MS : tx.status.location !== 'finalized' ? PENDING_POLL_MS : null;

function statusPill(status: TransactionDetails['status']) {
  if (status.location === 'finalized') {
    return status.success === false ? (
      <StatusPill tone="error">failed</StatusPill>
    ) : (
      <StatusPill tone="success">finalized</StatusPill>
    );
  }
  if (status.location === 'confirmed') return <StatusPill tone="pending">confirmed</StatusPill>;
  return <StatusPill tone="pending">pending (mempool)</StatusPill>;
}

function AccountLink({ hex }: { hex: string }) {
  return normalizeHash(hex) ? <HashLink value={toBase58(hex)} href={routes.account(hex)} /> : <HashLink value={hex} />;
}

export default function TransactionPage() {
  const sig = useQueryParam('sig');
  const { status, data: tx, error, refreshError, lastSuccess, retry } = useEntity(sig, (id, signal) => api.getTransaction(id, { signal }), pollUntilFinal);

  const body = tx?.body;
  const tokenId = body?.token_id && normalizeTokenId(body.token_id);

  return (
    <>
      <Header />
      <EntityPage title="Transaction">
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <ErrorCard message={error ?? 'Could not load the transaction.'} onRetry={retry} />
        ) : !tx ? (
          <NotFoundCard what="transaction" id={sig ?? ''} />
        ) : (
          <>
            <RefreshNotice error={refreshError} lastSuccess={lastSuccess} onRetry={retry} />
            <div className="rounded-lg border border-border/60 bg-card px-5">
              <DetailRow label="Signature">
                <HashLink value={tx.hash} truncateTo={false} />
              </DetailRow>
              <DetailRow label="Status">{statusPill(tx.status)}</DetailRow>
              {tx.status.error ? (
                <DetailRow label="Error">
                  <span className="text-red-400">{tx.status.error}</span>
                </DetailRow>
              ) : null}
              {tx.status.slot !== undefined ? (
                <DetailRow label="Slot">
                  <HashLink value={String(tx.status.slot)} href={routes.block(tx.status.slot)} truncateTo={false} />
                </DetailRow>
              ) : null}
              {tx.status.block_hash ? (
                <DetailRow label="Block">
                  <HashLink value={tx.status.block_hash} href={routes.block(tx.status.block_hash)} />
                </DetailRow>
              ) : null}
              <DetailRow label="Type">{body?.type ?? 'Unknown'}</DetailRow>
              <DetailRow label="From">
                <AccountLink hex={tx.sender} />
              </DetailRow>
              {body?.to ? (
                <DetailRow label="To">
                  <AccountLink hex={body.to} />
                </DetailRow>
              ) : null}
              {body?.amount !== undefined ? (
                <DetailRow label="Amount">
                  {body.token_id ? `${formatInteger(body.amount)} tokens` : `${formatBunker(body.amount)} BUNKER`}
                </DetailRow>
              ) : null}
              {body?.token_id ? (
                <DetailRow label="Token">
                  <HashLink value={body.token_id} href={tokenId ? routes.token(tokenId) : undefined} truncateTo={false} />
                </DetailRow>
              ) : null}
              <DetailRow label="Fee">{formatBunker(tx.fee)} BUNKER</DetailRow>
              <DetailRow label="Nonce">{tx.nonce.toString()}</DetailRow>
            </div>
          </>
        )}
      </EntityPage>
    </>
  );
}
