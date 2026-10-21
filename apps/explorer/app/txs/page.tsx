'use client';

import { useEffect, useState } from 'react';
import { normalizeHash, shortId, toBase58 } from '@bunkercoin/chain-format';
import { Button, Pagination, Panel, Skeleton, StatePanel, StatusTag } from '@bunkercoin/ui';
import { DataTable } from '@bunkercoin/ui/explorer';
import { slotLabel } from '@/components/blocks-table';
import { RefreshState, unreachable } from '@/components/detail';
import { useEntity } from '@/lib/use-entity';
import { api, errorMessage, isAbort } from '@/lib/api';
import { createGate } from '@/lib/request-gate';
import { routes } from '@/lib/routes';
import { tokenLabel } from '@/lib/token-label';
import { appendTxs, emptyTxs, TX_PAGE_SIZE, txAmount, txExecution, txType, type TxList } from '@/lib/txs';
import type { TransactionDetails } from '@/lib/types';

const b58 = (hex: string) => (normalizeHash(hex) ? toBase58(hex) : hex);
const slotText = (t: TransactionDetails) => (t.status.slot === undefined ? '–' : slotLabel(t.status.slot));
const LABELS = { error: "couldn't load older transactions", end: 'end of recent history' };

/** E12: the node's newest-first transaction feed with explicit `load older`. */
export default function TxsPage() {
  const first = useEntity('txs', (_, signal) => api.getTransactions(0, TX_PAGE_SIZE, { signal }));
  const registry = useEntity('tokens', (_, signal) => api.getTokens({ signal }));
  const [more, setMore] = useState<{ list: TxList; loading: boolean; error: string | null } | null>(null);
  const [gate] = useState(createGate);

  useEffect(() => () => gate.cancel(), [gate]);

  const list = more?.list ?? (first.data ? appendTxs(emptyTxs, first.data, TX_PAGE_SIZE) : null);
  const byId = new Map((registry.data ?? []).map((t) => [t.id, t]));
  const ticker = (id: string) => tokenLabel(id, byId.get(id));

  const loadOlder = async () => {
    if (!list || list.done || gate.busy()) return;
    const ticket = gate.begin();
    setMore({ list, loading: true, error: null });
    try {
      const page = await api.getTransactions(list.consumed, TX_PAGE_SIZE, { signal: ticket.signal });
      if (ticket.current()) setMore({ list: appendTxs(list, page, TX_PAGE_SIZE), loading: false, error: null });
    } catch (e) {
      if (ticket.current() && !isAbort(e)) setMore({ list, loading: false, error: errorMessage(e) });
    } finally {
      gate.finish(ticket);
    }
  };

  let body;
  if (first.status === 'loading') body = <Skeleton rows={6} columns={5} label="loading transactions…" />;
  else if (first.status === 'error' || !list)
    body = (
      <StatePanel
        state="error"
        title="Transactions unavailable."
        message={unreachable(first.error)}
        actions={
          <Button variant="primary" onClick={first.retry}>
            retry
          </Button>
        }
      />
    );
  else
    body = (
      <Panel
        flush
        footer={
          list.txs.length > 0 && (
            <Pagination
              state={more?.loading ? 'loading' : more?.error ? 'error' : list.done ? 'end' : 'idle'}
              onMore={() => void loadOlder()}
              note={<span className="bc-hint mono">{list.txs.length} loaded</span>}
              labels={LABELS}
            />
          )
        }
      >
        <DataTable<TransactionDetails>
          caption="transactions"
          columns={[
            { key: 'id', header: 'id', cell: (t) => <span className="mono">{shortId(b58(t.hash))}</span> },
            { key: 'type', header: 'type', cell: (t) => txType(t) },
            { key: 'from', header: 'from', cell: (t) => <span className="mono">{shortId(b58(t.sender))}</span> },
            { key: 'amount', header: 'amount', align: 'right', cell: (t) => <span className="mono">{txAmount(t, ticker)}</span> },
            { key: 'slot', header: 'slot', align: 'right', cell: (t) => <span className="mono">{slotText(t)}</span> },
            { key: 'execution', header: 'execution', cell: (t) => (t.status.success === false ? <StatusTag status="failed" /> : <span className="bc-hint">{txExecution(t)}</span>) },
          ]}
          rows={list.txs}
          rowKey={(t) => t.hash}
          rowHref={(t) => routes.tx(t.hash)}
          phone={(t) => (
            <>
              <span className="flex items-center gap-2.5">
                <span className="mono">{shortId(b58(t.hash))}</span>
                <span className="bc-hint">{txType(t)}</span>
              </span>
              <span className="bc-hint mono block">{txAmount(t, ticker)}</span>
              <span className="bc-hint mono block">
                slot {slotText(t)} · {txExecution(t)}
              </span>
            </>
          )}
          empty="No transactions in recent blocks."
        />
      </Panel>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="bc-t1 m-0">Transactions.</h1>
        <RefreshState entity={first} />
      </div>
      {body}
    </div>
  );
}
