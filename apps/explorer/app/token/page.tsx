'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Header from '@/components/header';
import { EntityPage, DetailRow, HashLink, NotFoundCard, ErrorCard, Loading } from '@/components/explorer-ui';
import { useQueryParam } from '@/lib/use-query-param';
import { useEntity } from '@/lib/use-entity';
import { api, errorMessage, HOLDER_PAGE_SIZE, isAbort } from '@/lib/api';
import { appendHolders, emptyHolders, type HolderList } from '@/lib/holders';
import { createGate } from '@/lib/request-gate';
import { toBase58 } from '@/lib/codec';
import { formatInteger } from '@/lib/amount';
import { routes } from '@/lib/routes';

interface MoreHolders {
  key: string;
  list: HolderList;
  loading: boolean;
  error: string | null;
}

export default function TokenPage() {
  const id = useQueryParam('id');
  const token = useEntity(id, (key, signal) => api.getToken(key, { signal }));
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
    if (!id || !list || list.done || gate.busy()) return;
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

  const t = token.data;

  return (
    <>
      <Header />
      <EntityPage title="Token">
        {token.status === 'loading' ? (
          <Loading />
        ) : token.status === 'error' ? (
          <ErrorCard message={token.error ?? 'Could not load the token.'} onRetry={token.retry} />
        ) : !t ? (
          <NotFoundCard what="token" id={id ?? ''} />
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border border-border/60 bg-card px-5">
              <DetailRow label="Token ID">
                <HashLink value={t.id} truncateTo={false} />
              </DetailRow>
              <DetailRow label="Ticker">{t.ticker}</DetailRow>
              <DetailRow label="Supply">{formatInteger(t.current_supply)}</DetailRow>
              {t.max_supply !== undefined ? (
                <DetailRow label="Max supply">{formatInteger(t.max_supply)}</DetailRow>
              ) : null}
            </div>

            {firstPage.status === 'error' ? (
              <ErrorCard message={`Holders unavailable: ${firstPage.error}`} onRetry={firstPage.retry} />
            ) : holders.length > 0 ? (
              <div className="rounded-lg border border-border/60 bg-card p-5">
                <h3 className="text-sm font-medium mb-3">Holders ({total.toLocaleString('en-US')})</h3>
                <div className="space-y-2">
                  {holders.map((h) => (
                    <div key={h.pubkey} className="flex items-center justify-between text-sm">
                      <HashLink value={toBase58(h.pubkey)} href={routes.account(h.pubkey)} />
                      <span className="font-mono">{formatInteger(h.balance)}</span>
                    </div>
                  ))}
                </div>
                {list && !list.done ? (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={extra?.loading}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
                  >
                    {extra?.loading ? <Loader2 size={13} className="animate-spin" /> : null}
                    Load more holders ({holders.length} of {total.toLocaleString('en-US')})
                  </button>
                ) : null}
                {extra?.error ? <p className="mt-2 text-xs text-red-400">{extra.error}</p> : null}
              </div>
            ) : null}
          </div>
        )}
      </EntityPage>
    </>
  );
}
