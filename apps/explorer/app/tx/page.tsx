'use client';

import { formatInteger, formatUnits, normalizeHash, normalizeTokenId, shortId, toBase58 } from '@bunkercoin/chain-format';
import { BackLink, CopyValue, Disclosure, Facts, Link, Notice, StatusTag, type Fact } from '@bunkercoin/ui';
import { Lifecycle } from '@bunkercoin/ui/explorer';
import { slotLabel } from '@/components/blocks-table';
import { DetailGate, RefreshState } from '@/components/detail';
import { useQueryParam } from '@/lib/use-query-param';
import { useEntity, type EntityState } from '@/lib/use-entity';
import { api } from '@/lib/api';
import { routes } from '@/lib/routes';
import { tokenLabel } from '@/lib/token-label';
import type { TransactionDetails } from '@/lib/types';

// Until final, keep refreshing; a missing tx may still be propagating over radio.
const PENDING_POLL_MS = 5000;
const NOT_FOUND_POLL_MS = 15_000;
const pollUntilFinal = (tx: TransactionDetails | null) =>
  tx === null ? NOT_FOUND_POLL_MS : tx.status.location !== 'finalized' ? PENDING_POLL_MS : null;

const LOCATIONS = ['mempool', 'confirmed', 'finalized'] as const;
const TYPES: Record<string, string> = {
  Transfer: 'transfer',
  TokenTransfer: 'token transfer',
  Mint: 'create token',
};

function AccountValue({ hex }: { hex: string }) {
  if (!normalizeHash(hex)) return <span className="mono">{hex}</span>;
  const b58 = toBase58(hex);
  return <CopyValue value={b58} href={routes.account(hex)} label="address" />;
}

function execution(s: TransactionDetails['status']) {
  if (s.success === true) return 'succeeded';
  if (s.success === false) return 'failed';
  return 'not reported';
}

function TxView({ tx, entity }: { tx: TransactionDetails; entity: EntityState<TransactionDetails> }) {
  const body = tx.body;
  const tokenId = body?.token_id ? normalizeTokenId(body.token_id) : null;
  const token = useEntity(tokenId, (key, signal) => api.getToken(key, { signal }));
  const id = normalizeHash(tx.hash) ? toBase58(tx.hash) : tx.hash;
  const at = LOCATIONS.indexOf(tx.status.location);
  const slot = tx.status.slot;

  const amount =
    body?.amount === undefined
      ? null
      : tokenId
        ? (
            <>
              {formatInteger(body.amount)} {tokenLabel(tokenId, token.data)}{' '}
              <span className="bc-s">
                · <Link className="bc-lnk" href={routes.token(tokenId)}>{tokenId}</Link>
              </span>
            </>
          )
        : `${formatUnits(body.amount, 6)} BUNKER`;

  const key: Fact[] = [
    { label: 'type', value: body ? (TYPES[body.type] ?? body.type) : 'not reported' },
    ...(amount ? [{ label: 'amount', value: amount }] : []),
    ...(!amount && tokenId ? [{ label: 'token', value: <Link className="bc-lnk" href={routes.token(tokenId)}>{tokenId}</Link> }] : []),
    ...(body?.ticker !== undefined ? [{ label: 'ticker', value: body.ticker }] : []),
    ...(body?.max_supply !== undefined ? [{ label: 'max supply', value: formatInteger(body.max_supply) }] : []),
    ...(body?.metadata_hash ? [{ label: 'metadata hash', value: <CopyValue value={body.metadata_hash} label="metadata hash" /> }] : []),
    { label: 'from', value: <AccountValue hex={tx.sender} /> },
    ...(body?.to ? [{ label: 'to', value: <AccountValue hex={body.to} /> }] : []),
  ];
  const more: Fact[] = [
    { label: 'execution', value: execution(tx.status) },
    { label: 'fee', value: `${formatUnits(tx.fee, 6)} BUNKER` },
    { label: 'nonce', value: tx.nonce.toString() },
    ...(slot !== undefined ? [{ label: 'slot', value: <Link className="bc-lnk" href={routes.block(slot)}>{slotLabel(slot)}</Link> }] : []),
    ...(tx.status.block_hash
      ? [{ label: 'block', value: <Link className="bc-lnk" href={routes.block(tx.status.block_hash)}>{shortId(tx.status.block_hash)}</Link> }]
      : []),
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="bc-t1 m-0">Transaction.</h1>
        <StatusTag status={tx.status.location} />
        {tx.status.success === false && <StatusTag status="failed" />}
        <RefreshState entity={entity} />
      </div>
      <CopyValue value={id} mode="full" label="transaction id" />
      <Lifecycle
        current={at}
        steps={[
          { label: 'mempool' },
          { label: slot !== undefined ? `confirmed · slot ${slotLabel(slot)}` : 'confirmed' },
          { label: 'finalized' },
        ]}
      />
      {tx.status.success === false && (
        <Notice tone="error" title="Execution failed.">
          {tx.status.error && <span className="mono">{tx.status.error}</span>}
        </Notice>
      )}
      <Facts columns={2} items={key} />
      <Disclosure summary="details">
        <Facts columns={3} items={more} />
      </Disclosure>
    </>
  );
}

export default function TransactionPage() {
  const sig = useQueryParam('sig');
  const entity = useEntity(sig, (id, signal) => api.getTransaction(id, { signal }), pollUntilFinal);
  return (
    <DetailGate
      entity={entity}
      id={sig}
      what="transaction"
      back={<BackLink label="blocks" href="/blocks" />}
      missing="Search for a transaction id."
      unavailable="Transaction unavailable."
      notFound={{ title: 'No transaction with this id.', message: 'It may still be arriving over radio. Checking every 15s.' }}
    >
      {(tx) => <TxView tx={tx} entity={entity} />}
    </DetailGate>
  );
}
