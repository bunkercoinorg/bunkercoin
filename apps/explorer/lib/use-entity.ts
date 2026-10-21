'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, isAbort } from './api';
import { nextDelay, settle, type EntityStatus, type Outcome, type Settled } from './entity-state';

export type { EntityStatus } from './entity-state';

export interface EntityState<T> {
  status: EntityStatus;
  data: T | null;
  error: string | null;
  refreshError: string | null;
  lastSuccess: number | null;
  retry: () => void;
}

const empty = { data: null, error: null, refreshError: null, lastSuccess: null };

// Loads one entity per id. State from a previous id is never shown, 404 is
// distinct from failure, and `pollMs` keeps refreshing while it returns a delay.
export function useEntity<T>(
  id: string | null | undefined,
  fetcher: (id: string, signal: AbortSignal) => Promise<T | null>,
  pollMs?: (data: T | null) => number | null,
): EntityState<T> {
  const [stored, setStored] = useState<(Settled<T> & { key: string }) | null>(null);
  const fetcherRef = useRef(fetcher);
  const pollRef = useRef(pollMs);
  const pokeRef = useRef<() => void>(() => {});

  useEffect(() => {
    fetcherRef.current = fetcher;
    pollRef.current = pollMs;
  });

  useEffect(() => {
    if (!id) return;
    let disposed = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;
    let last: Settled<T> | null = null;

    async function run() {
      clearTimeout(timer);
      if (disposed || inFlight) return;
      inFlight = true;
      ctrl = new AbortController();
      let outcome: Outcome<T>;
      try {
        outcome = { ok: true, data: await fetcherRef.current(id as string, ctrl.signal) };
      } catch (e) {
        if (isAbort(e)) return;
        outcome = { ok: false, error: errorMessage(e) };
      } finally {
        inFlight = false;
      }
      if (disposed) return;
      last = settle(last, outcome, Date.now());
      setStored({ key: id as string, ...last });
      const delay = nextDelay(last, pollRef.current);
      if (delay !== null) timer = setTimeout(run, delay);
    }

    pokeRef.current = () => void run();
    void run();
    return () => {
      disposed = true;
      pokeRef.current = () => {};
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, [id]);

  // A failed load shows the spinner again; a failed refresh keeps its data.
  const retry = useCallback(() => {
    setStored((s) => (s?.status === 'error' ? null : s));
    pokeRef.current();
  }, []);

  if (id === undefined) return { status: 'loading', ...empty, retry };
  if (!id) return { status: 'idle', ...empty, retry };
  if (!stored || stored.key !== id) return { status: 'loading', ...empty, retry };
  const { status, data, error, refreshError, lastSuccess } = stored;
  return { status, data, error, refreshError, lastSuccess, retry };
}
