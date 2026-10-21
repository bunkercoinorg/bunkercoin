export type EntityStatus = 'loading' | 'ready' | 'not-found' | 'error' | 'idle';

// `error` means nothing could be loaded; `refreshError` means the shown data
// is cached from `lastSuccess` because the latest refresh failed.
export interface Settled<T> {
  status: 'ready' | 'not-found' | 'error';
  data: T | null;
  error: string | null;
  refreshError: string | null;
  lastSuccess: number | null;
}

export type Outcome<T> = { ok: true; data: T | null } | { ok: false; error: string };

export function settle<T>(prev: Settled<T> | null, outcome: Outcome<T>, now: number): Settled<T> {
  if (outcome.ok) {
    const status = outcome.data === null ? 'not-found' : 'ready';
    return { status, data: outcome.data, error: null, refreshError: null, lastSuccess: now };
  }
  if (prev && prev.data !== null) return { ...prev, status: 'ready', refreshError: outcome.error };
  return { status: 'error', data: null, error: outcome.error, refreshError: null, lastSuccess: prev?.lastSuccess ?? null };
}

// Polling follows the last known entity, so a transient failure never ends it.
export const nextDelay = <T>(s: Settled<T>, pollMs?: (data: T | null) => number | null): number | null =>
  pollMs?.(s.data) ?? null;
