'use client';

import { useState } from 'react';
import { formatInteger, normalizeHash, shortId, toBase58 } from '@bunkercoin/chain-format';
import { Button, EmptyState, Panel, Skeleton, StatePanel, TextInput } from '@bunkercoin/ui';
import { DataTable } from '@bunkercoin/ui/explorer';
import { unreachable } from '@/components/detail';
import { useEntity } from '@/lib/use-entity';
import { api } from '@/lib/api';
import { routes } from '@/lib/routes';
import { tokenLabel } from '@/lib/token-label';
import type { TokenSummary } from '@/lib/types';

const creator = (hex?: string) => (hex ? shortId(normalizeHash(hex) ? toBase58(hex) : hex) : '–');
const supply = (t: TokenSummary) => `${formatInteger(t.current_supply)} / ${t.max_supply === undefined ? '–' : formatInteger(t.max_supply)}`;

export default function TokensPage() {
  const registry = useEntity('tokens', (_, signal) => api.getTokens({ signal }));
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  const all = [...(registry.data ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const rows = q ? all.filter((t) => t.ticker.toLowerCase().includes(q) || t.id.includes(q)) : all;

  let body;
  if (registry.status === 'loading') body = <Skeleton rows={4} columns={4} label="loading tokens…" />;
  else if (registry.status === 'error')
    body = (
      <StatePanel
        state="error"
        title="Tokens unavailable."
        message={unreachable(registry.error)}
        actions={
          <Button variant="primary" onClick={registry.retry}>
            retry
          </Button>
        }
      />
    );
  else if (!all.length) body = <EmptyState>No tokens created yet.</EmptyState>;
  else if (!rows.length)
    body = (
      <EmptyState
        action={
          <Button variant="ghost" size="sm" onClick={() => setFilter('')}>
            clear filter
          </Button>
        }
      >
        No token matches &quot;{filter.trim()}&quot;.
      </EmptyState>
    );
  else
    body = (
      <Panel flush>
        <DataTable
          caption="tokens"
          columns={[
            { key: 'ticker', header: 'ticker', cell: (t) => tokenLabel(t.id, t) },
            { key: 'id', header: 'token id', cell: (t) => <span className="mono">{t.id}</span> },
            { key: 'supply', header: 'supply / max', align: 'right', cell: (t) => <span className="mono">{supply(t)}</span> },
            { key: 'creator', header: 'creator', cell: (t) => <span className="mono">{creator(t.creator)}</span> },
          ]}
          rows={rows}
          rowKey={(t) => t.id}
          rowHref={(t) => routes.token(t.id)}
          phone={(t) => (
            <>
              <span className="block">{tokenLabel(t.id, t)}</span>
              <span className="bc-hint mono block">
                {t.id} · {supply(t)}
              </span>
            </>
          )}
          empty="No tokens created yet."
        />
      </Panel>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="bc-t1 m-0">Tokens.</h1>
        <div className="w-full sm:w-[360px]">
          <label className="bc-sr" htmlFor="token-filter">
            filter
          </label>
          <TextInput mono id="token-filter" value={filter} placeholder="filter by ticker or id" autoComplete="off" spellCheck={false} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>
      {body}
    </div>
  );
}
