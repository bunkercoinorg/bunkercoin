'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { routes } from '@/lib/routes';
import type { SearchMatch } from '@/lib/types';

function hrefFor(match: SearchMatch): string {
  switch (match.kind) {
    case 'transaction':
      return routes.tx(match.id);
    case 'account':
      return routes.account(match.id);
    case 'block':
      return routes.block(match.id);
    case 'token':
      return routes.token(match.id);
  }
}

// Universal explorer search: paste a transaction signature, account address,
// block slot/hash, or token id and route to its detail page. Candidates come
// from the query's shape and are kept only if the node knows them.
export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<SearchMatch[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setChoices([]);
    try {
      const matches = await api.search(q);
      if (matches.length === 1) router.push(hrefFor(matches[0]));
      else if (matches.length > 1) setChoices(matches);
      else setError('Nothing on chain matches that transaction, account, block, or token.');
    } catch {
      setError('Search failed — the explorer API may be unreachable.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full" role="search">
      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
            if (choices.length) setChoices([]);
          }}
          aria-label="Search by tx signature, address, block, or token"
          placeholder="Search by tx signature, address, block, or token"
          spellCheck={false}
          autoComplete="off"
          // text-base (16px) on mobile prevents iOS Safari from auto-zooming
          // the viewport on focus; sm:text-sm restores the compact size on
          // larger screens.
          className="w-full rounded-lg border border-border bg-card pl-9 pr-24 py-2.5 text-base sm:text-sm font-mono outline-none focus:border-emerald-500/60 transition-colors"
        />
        <button
          type="submit"
          disabled={busy}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 disabled:opacity-50 px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : null}
          Search
        </button>
      </div>
      {error ? <p className="text-xs text-red-400 mt-2 px-1">{error}</p> : null}
      {choices.length ? (
        <div className="mt-2 px-1 text-xs text-muted-foreground">
          Matches more than one entity:
          <ul className="mt-1 space-y-1">
            {choices.map((m) => (
              <li key={`${m.kind}:${m.id}`}>
                <Link href={hrefFor(m)} className="font-mono text-emerald-500 hover:underline break-all">
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
