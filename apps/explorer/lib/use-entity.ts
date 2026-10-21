'use client';

import { useEffect, useRef, useState } from 'react';
import { errorMessage, isAbort } from './api';

export type EntityStatus = 'loading' | 'ready' | 'not-found' | 'error' | 'idle';

export interface EntityState<T> {
  status: EntityStatus;
  data: T | null;
  error: string | null;
  retry: () => void;
}

interface Stored<T> {
  key: string;
  status: EntityStatus;
  data: T | null;
  error: string | null;
}

// Loads one entity per id. State from a previous id is never shown, 404 is
// distinct from failure, and `pollMs` keeps refreshing while it returns a delay.
export function useEntity<T>(
  id: string | null | undefined,
  fetcher: (id: string, signal: AbortSignal) => Promise<T | null>,
  pollMs?: (data: T | null) => number | null,
): EntityState<T> {
  const [stored, setStored] = useState<Stored<T> | null>(null);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  const pollRef = useRef(pollMs);

  useEffect(() => {
    fetcherRef.current = fetcher;
    pollRef.current = pollMs;
  });

  useEffect(() => {
    if (!id) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;
    const key = `${id}#${nonce}`;
    let last: T | null = null;

    const schedule = (data: T | null) => {
      const delay = pollRef.current?.(data) ?? null;
      if (delay !== null && !disposed) timer = setTimeout(run, delay);
    };

    async function run() {
      ctrl = new AbortController();
      try {
        const data = await fetcherRef.current(id as string, ctrl.signal);
        if (disposed) return;
        last = data;
        setStored({ key, status: data === null ? 'not-found' : 'ready', data, error: null });
        schedule(data);
      } catch (e) {
        if (disposed || isAbort(e)) return;
        setStored({ key, status: last === null ? 'error' : 'ready', data: last, error: errorMessage(e) });
        if (last !== null) schedule(last);
      }
    }

    void run();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, [id, nonce]);

  const retry = () => setNonce((n) => n + 1);
  if (id === undefined) return { status: 'loading', data: null, error: null, retry };
  if (!id) return { status: 'idle', data: null, error: null, retry };
  if (!stored || stored.key !== `${id}#${nonce}`) return { status: 'loading', data: null, error: null, retry };
  return { status: stored.status, data: stored.data, error: stored.error, retry };
}
