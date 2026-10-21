'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { atom, useSetAtom } from 'jotai';
import { Button, TextInput } from '@bunkercoin/ui';
import { HeaderSearch } from '@bunkercoin/ui/explorer';
import { api } from '@/lib/api';
import { classifyQuery, searchOutcome } from '@/lib/search';
import { routes } from '@/lib/routes';
import { useQueryParam } from '@/lib/use-query-param';
import type { SearchMatch } from '@/lib/types';

export const SEARCH_PLACEHOLDER = 'slot, hash, tx id, address or token id';

export function hrefFor(match: SearchMatch): string {
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

export const searchPath = (q: string) => `/search?q=${encodeURIComponent(q)}`;

/** The last resolved query, so /search shows it without probing again while it is fresh. */
export const lastSearchAtom = atom<{ q: string; matches: SearchMatch[]; at: number } | null>(null);
export const SEARCH_FRESH_MS = 15_000;

// One confirmed match routes; anything else (several, none, invalid, API down) lands on /search.
function useSiteSearch() {
  const router = useRouter();
  const setLast = useSetAtom(lastSearchAtom);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const q = query.trim();
    if (!q || busy) return;
    if (!classifyQuery(q).length) {
      setLast(null);
      router.push(searchPath(q));
      return;
    }
    setBusy(true);
    try {
      const matches = await api.search(q);
      const outcome = searchOutcome(matches);
      setLast({ q, matches, at: Date.now() });
      router.push(outcome.kind === 'route' ? hrefFor(outcome.match) : searchPath(q));
    } catch {
      setLast(null);
      router.push(searchPath(q));
    } finally {
      setBusy(false);
    }
  }

  return { query, setQuery, busy, submit };
}

export function HeaderSiteSearch() {
  const s = useSiteSearch();
  const onSearch = usePathname()?.replace(/\/+$/, '') === '/search';
  const q = useQueryParam('q');
  const { setQuery } = s;
  useEffect(() => {
    if (onSearch && q !== undefined) setQuery(q);
  }, [onSearch, q, setQuery]);
  return <HeaderSearch value={s.query} onChange={s.setQuery} onSubmit={() => void s.submit()} busy={s.busy} placeholder={SEARCH_PLACEHOLDER} />;
}

/** The full-size search beside the overview title. */
export function PageSearch() {
  const s = useSiteSearch();
  const id = useId();
  return (
    <form
      className="bc-ig w-full max-w-[560px] sm:flex-[1_1_320px]"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        void s.submit();
      }}
    >
      <label className="bc-sr" htmlFor={id}>
        search
      </label>
      <TextInput mono id={id} value={s.query} placeholder={SEARCH_PLACEHOLDER} autoComplete="off" spellCheck={false} onChange={(e) => s.setQuery(e.target.value)} />
      <Button variant="primary" type="submit" busy={s.busy}>
        {s.busy ? 'searching…' : 'search'}
      </Button>
    </form>
  );
}
