'use client';

import { useAtomValue } from 'jotai';
import { formatDistanceToNow } from 'date-fns';
import { blocksFeedAtom, nodesFeedAtom } from '@/lib/atoms';

export default function FeedBanner({ onRetry }: { onRetry: () => void }) {
  const blocks = useAtomValue(blocksFeedAtom);
  const nodes = useAtomValue(nodesFeedAtom);
  const error = blocks.error ?? nodes.error;
  if (!error) return null;
  const last = blocks.lastSuccess;

  return (
    <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
      <span className="text-red-300">
        {error}{' '}
        {last ? `Showing data from ${formatDistanceToNow(last, { addSuffix: true })}.` : 'No data loaded yet.'}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30"
      >
        Retry now
      </button>
    </div>
  );
}
