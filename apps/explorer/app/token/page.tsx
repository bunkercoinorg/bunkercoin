'use client';

import { useEffect, useState } from 'react';
import { formatInteger, normalizeHash, toBase58 } from '@bunkercoin/chain-format';
import { BackLink, Button, CopyValue, EmptyState, Facts, Pagination, Panel, Skeleton, type Fact } from '@bunkercoin/ui';
import { DataTable, ShareBar } from '@bunkercoin/ui/explorer';
import { DetailGate } from '@/components/detail';
import { useQueryParam } from '@/lib/use-query-param';
import { useEntity } from '@/lib/use-entity';
import { api, errorMessage, HOLDER_PAGE_SIZE, isAbort } from '@/lib/api';
import { appendHolders, emptyHolders, type HolderList } from '@/lib/holders';
import { createGate } from '@/lib/request-gate';
import { routes } from '@/lib/routes';
import { tokenLabel } from '@/lib/token-label';
import type { TokenHolder, TokenSummary } from '@/lib/types';

interface MoreHolders {
  key: string;
  list: HolderList;
  loading: boolean;
  error: string | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function share(balance: bigint, supply: bigint): { fraction: number; label: string } {
  if (supply <= 0n) return { fraction: 0, label: '–' };
  const permille = (balance * 1000n + supply / 2n) / supply;
  if (balance > 0n && permille === 0n) return { fraction: 0.001, label: '<0.1%' };
  return { fraction: Number(permille) / 1000, label: `${(Number(permille) / 10).toFixed(1)}%` };
}

function account(hex: string) {
  return normalizeHash(hex) ? <CopyValue value={toBase58(hex)} href={routes.account(hex)} label="address" /> : <span className="mono">{hex}</span>;
}

function Holders({ id, token }: { id: string; token: TokenSummary }) {
  const firstPage = useEntity(id, (key, signal) => api.getTokenHolders(key, 0, HOLDER_PAGE_SIZE, { signal }));
  const [more, setMore] = useState<MoreHolders | null>(null);
  const [gate] = useState(createGate);

  useEffect(() => () => gate.cancel(), [gate]);

  const extra = more && more.key === id ? more : null;
  const first = firstPage.data ? appendHolders(emptyHolders, firstPage.data, HOLDER_PAGE_SIZE) : null;
  const list = extra?.list ?? first;
  const holders = list?.holders ?? [];
  const total = list?.total ?? 0;

  const loadMore = async () => {
    if (!list || list.done || gate.busy()) return;
    const ticket = gate.begin();
    setMore({ key: id, list, loading: true, error: null });
    try {
      const page = await api.getTokenHolders(id, list.consumed, HOLDER_PAGE_SIZE, { signal: ticket.signal });
      if (ticket.current()) setMore({ key: id, list: appendHolders(list, page, HOLDER_PAGE_SIZE), loading: false, error: null });
    } catch (e) {
      if (ticket.current() && !isAbort(e)) setMore({ key: id, list, loading: false, error: errorMessage(e) });
    } finally {
      gate.finish(ticket);
    }
  };

  const rank = new Map(holders.map((h, i) => [h.pubkey, i + 1]));
  const meta = holders.length ? (total > holders.length ? `${holders.length} of ${formatInteger(BigInt(total))}` : `${holders.length} holders loaded`) : undefined;
  const footer = list && !list.done && holders.length > 0 && (
    <Pagination
      state={extra?.loading ? 'loading' : extra?.error ? 'error' : 'idle'}
      onMore={() => void loadMore()}
      labels={{ more: 'load more', loading: 'loading more…', error: "couldn't load more holders" }}
    />
  );

  return (
    <Panel title="holders" meta={meta} footer={footer} flush>
      {firstPage.status === 'loading' ? (
        <Skeleton rows={4} columns={4} label="loading holders…" />
      ) : firstPage.status === 'error' ? (
        <EmptyState
          action={
            <Button variant="ghost" size="sm" onClick={firstPage.retry}>
              retry
            </Button>
          }
        >
          Holders unavailable.
        </EmptyState>
      ) : (
        <DataTable<TokenHolder>
          caption="holders"
          columns={[
            { key: 'rank', header: 'rank', cell: (h) => <span className="mono">{pad2(rank.get(h.pubkey) ?? 0)}</span> },
            { key: 'holder', header: 'holder', cell: (h) => account(h.pubkey) },
            { key: 'held', header: 'held', align: 'right', cell: (h) => <span className="mono">{formatInteger(h.balance)}</span> },
            { key: 'share', header: 'share', cell: (h) => <ShareBar {...share(h.balance, token.current_supply)} /> },
          ]}
          rows={holders}
          rowKey={(h) => h.pubkey}
          phone={(h) => (
            <>
              <span className="flex items-center gap-2.5">
                <span className="bc-hint mono">{pad2(rank.get(h.pubkey) ?? 0)}</span>
                {account(h.pubkey)}
              </span>
              <span className="bc-hint mono block">
                {formatInteger(h.balance)} · {share(h.balance, token.current_supply).label}
              </span>
            </>
          )}
          empty="No holders yet."
        />
      )}
    </Panel>
  );
}

function TokenView({ token }: { token: TokenSummary }) {
  const facts: Fact[] = [
    {
      label: 'supply',
      value: (
        <>
          {formatInteger(token.current_supply)}
          {token.max_supply !== undefined && <span className="bc-s"> of {formatInteger(token.max_supply)}</span>}
        </>
      ),
    },
    ...(token.creator ? [{ label: 'creator', value: account(token.creator) }] : []),
    ...(token.metadata_hash ? [{ label: 'metadata', value: <CopyValue value={token.metadata_hash} label="metadata hash" /> }] : []),
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="bc-t1 m-0">{tokenLabel(token.id, token)}.</h1>
        <CopyValue value={token.id} mode="full" label="token id" />
      </div>
      <Facts columns={3} items={facts} />
      <Holders id={token.id} token={token} />
    </>
  );
}

export default function TokenPage() {
  const id = useQueryParam('id');
  const entity = useEntity(id, (key, signal) => api.getToken(key, { signal }));
  return (
    <DetailGate
      entity={entity}
      id={id}
      what="token"
      back={<BackLink label="tokens" href="/tokens" />}
      missing="Search for a token id."
      unavailable={`Token ${id ?? ''} unavailable.`}
      notFound={{ title: 'No token with this id.', message: 'Token ids are 8 hex characters, like 01000000.' }}
    >
      {(token) => <TokenView token={token} />}
    </DetailGate>
  );
}
