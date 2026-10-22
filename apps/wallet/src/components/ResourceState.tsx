'use client';

import { Freshness } from '@bunkercoin/ui';
import type { Freshness as ResourceFreshness } from '@/lib/freshness';

export const STALE_MS = 60_000;

/** Nothing while a resource is fresh; otherwise its age (or offline), the failure and a retry. */
export function ResourceState({ fresh, what, onRetry }: { fresh: ResourceFreshness; what: string; onRetry: () => void }) {
  const { okAt, error } = fresh;
  if (error === null && (okAt === null || Date.now() - okAt <= STALE_MS)) return null;
  return (
    <span className="bc-row">
      <Freshness lastSuccessAt={okAt} staleAfterMs={error === null ? STALE_MS : -1} onRetry={onRetry} />
      {error !== null && (
        <span className="bc-err" role="status">
          {what} unavailable: {error}
        </span>
      )}
    </span>
  );
}
