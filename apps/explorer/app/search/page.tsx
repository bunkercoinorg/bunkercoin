'use client';

import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { shortId, toBase58 } from '@bunkercoin/chain-format';
import { Button, Panel, StatePanel, StateLine, Tag } from '@bunkercoin/ui';
import { DataTable } from '@bunkercoin/ui/explorer';
import { slotLabel } from '@/components/blocks-table';
import { hrefFor, lastSearchAtom, PageSearch } from '@/components/site-search';
import { useQueryParam } from '@/lib/use-query-param';
import { api } from '@/lib/api';
import { classifyQuery } from '@/lib/search';
import type { SearchMatch } from '@/lib/types';

type Result = { q: string; state: 'loading' } | { q: string; state: 'error' } | { q: string; state: 'ready'; matches: SearchMatch[] };

const KIND: Record<SearchMatch['kind'], string> = { block: 'block', token: 'token', transaction: 'tx', account: 'account' };

function title(m: SearchMatch) {
  if (m.kind === 'block') return /^\d+$/.test(m.id) ? `slot ${slotLabel(m.id)}` : shortId(m.id);
  if (m.kind === 'token') return m.id;
  return shortId(toBase58(m.id));
}

export default function SearchPage() {
  const q = (useQueryParam('q') ?? '').trim();
  const last = useAtomValue(lastSearchAtom);
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const valid = classifyQuery(q).length > 0;

  useEffect(() => {
    if (!q || !valid) return;
    if (attempt === 0 && last?.q === q) {
      setResult({ q, state: 'ready', matches: last.matches });
      return;
    }
    let live = true;
    setResult({ q, state: 'loading' });
    api.search(q).then(
      (matches) => live && setResult({ q, state: 'ready', matches }),
      () => live && setResult({ q, state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [q, valid, attempt, last]);

  const current = result?.q === q ? result : null;
  let body;
  if (!q) body = <StatePanel heading="h1" state="empty" title="Search." message="Enter a slot, hash, address or token id." />;
  else if (!valid) body = <StatePanel heading="h1" state="empty" title="Enter a slot, hash, address or token id." message={<span className="mono">{q}</span>} />;
  else if (!current || current.state === 'loading') body = <StateLine>searching…</StateLine>;
  else if (current.state === 'error')
    body = (
      <StatePanel
        heading="h1"
        state="error"
        title="Can't reach the explorer API."
        message="Retry search."
        actions={
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            retry
          </Button>
        }
      />
    );
  else if (!current.matches.length)
    body = (
      <StatePanel heading="h1" state="notfound" title={`No matches for ${q}.`} message="Try a slot, a 64-character hash or an address." />
    );
  else {
    const n = current.matches.length;
    body = (
      <>
        <h1 className="bc-t1 m-0 [overflow-wrap:anywhere]">
          {n} {n === 1 ? 'match' : 'matches'} for {q}.
        </h1>
        <Panel flush>
          <DataTable
            caption="matches"
            columns={[
              {
                key: 'what',
                header: 'match',
                cell: (m) => (
                  <span className="bc-row">
                    <Tag>{KIND[m.kind]}</Tag>
                    <span className="mono">{title(m)}</span>
                  </span>
                ),
              },
              { key: 'note', header: 'note', cell: (m) => <span className="bc-hint">{m.inactive ? 'address with no recorded activity' : ''}</span> },
              { key: 'go', header: <span className="bc-sr">open</span>, align: 'right', cell: () => <span aria-hidden="true">→</span> },
            ]}
            rows={current.matches}
            rowKey={(m) => `${m.kind}:${m.id}`}
            rowHref={hrefFor}
            empty=""
          />
        </Panel>
        <p className="bc-hint m-0">
          Search directly with <span className="mono">slot:</span> or <span className="mono">token:</span>.
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageSearch key={q} initial={q} />
      {body}
    </div>
  );
}
