'use client';

import { useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { relativeAge, utcClock } from '@bunkercoin/chain-format';
import { Button } from './controls.tsx';

/**
 * live: acc square · final: fg square · pending: info outline square · unconfirmed: dashed info, no mark ·
 * unknown: dashed neutral, no mark · failed: danger · accent: producer / latest · neutral: plain frame.
 */
export type TagState = 'neutral' | 'live' | 'final' | 'pending' | 'unconfirmed' | 'unknown' | 'failed' | 'accent';

const MARKED: ReadonlySet<TagState> = new Set(['live', 'final', 'pending', 'failed']);

export function Tag({ state = 'neutral', children, className }: { state?: TagState; children: ReactNode; className?: string }) {
  return (
    <span className={className ? `bc-tag ${className}` : 'bc-tag'} data-tone={state}>
      {MARKED.has(state) && <i aria-hidden="true" />}
      {children}
    </span>
  );
}

export type Status =
  | 'live'
  | 'finalized'
  | 'confirming'
  | 'proposed'
  | 'notarized'
  | 'pending'
  | 'mempool'
  | 'confirmed'
  | 'unconfirmed'
  | 'unknown'
  | 'stale'
  | 'offline'
  | 'skipped'
  | 'awaiting'
  | 'failed'
  | 'producer'
  | 'latest';

const STATUS: Record<Status, [TagState, string]> = {
  live: ['live', 'live'],
  finalized: ['final', 'finalized'],
  confirming: ['pending', 'confirming'],
  proposed: ['pending', 'proposed'],
  notarized: ['pending', 'notarized'],
  pending: ['pending', 'pending'],
  mempool: ['pending', 'mempool'],
  confirmed: ['pending', 'confirmed'],
  unconfirmed: ['unconfirmed', 'still unconfirmed'],
  unknown: ['unknown', 'outcome unknown'],
  stale: ['unknown', 'stale'],
  offline: ['unknown', 'offline'],
  skipped: ['unknown', 'skipped'],
  awaiting: ['unknown', 'awaiting first sample'],
  failed: ['failed', 'failed'],
  producer: ['accent', 'producer'],
  latest: ['accent', 'latest'],
};

/** The tag vocabulary: `<StatusTag status="confirming" detail="18s" />` renders `confirming · 18s`. */
export function StatusTag({ status, detail, className }: { status: Status; detail?: ReactNode; className?: string }) {
  const [state, label] = STATUS[status];
  return (
    <Tag state={state} className={className}>
      {label}
      {detail !== undefined && detail !== null && <> · {detail}</>}
    </Tag>
  );
}

/** info: --info left rule · warn: dashed neutral frame · error: danger left rule. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  ...rest
}: { tone?: 'info' | 'warn' | 'error'; title?: ReactNode; children?: ReactNode; action?: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <div className="bc-nt" data-tone={tone} {...rest}>
      <div className="bc-grow">
        {title && <b>{title} </b>}
        {children}
      </div>
      {action}
    </div>
  );
}

export type PanelState = 'loading' | 'empty' | 'error' | 'missing' | 'notfound';

/** The one empty / error / not-found layout. `heading="h1"` when it is the whole page. */
export function StatePanel({
  state,
  title,
  message,
  id,
  actions,
  heading: H = 'h2',
}: {
  state: PanelState;
  title: ReactNode;
  message?: ReactNode;
  id?: string;
  actions?: ReactNode;
  heading?: 'h1' | 'h2';
}) {
  return (
    <section className="bc-spn" data-state={state} role={state === 'loading' ? 'status' : undefined}>
      <H className="bc-t2">{title}</H>
      {message && <p className="bc-small">{message}</p>}
      {id && <p className="bc-hint mono">{id}</p>}
      {actions && <div className="bc-acts">{actions}</div>}
    </section>
  );
}

/** Empty success: one dim sentence and one relevant action. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="bc-empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Named operation while a first request is in flight (`checking balance…`). */
export function StateLine({ children }: { children: ReactNode }) {
  return (
    <p className="bc-stl" role="status">
      {children}
    </p>
  );
}

/** Hairline boxes, no shimmer. `columns` is a grid-template-columns list. */
export function Skeleton({
  rows = 8,
  columns = ['90px', '110px', '1fr', '70px', '50px'],
  label,
}: {
  rows?: number;
  columns?: string[];
  label?: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite">
      {label ? <p className="bc-stl">{label}</p> : <span className="bc-sr">loading</span>}
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="bc-skr" style={{ '--cols': columns.join(' ') } as CSSProperties}>
            {columns.map((_, c) => (
              <span key={c} className="bc-sk" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export type Step = { label: ReactNode; state: 'done' | 'active' | 'pending' | 'error'; detail?: ReactNode; ms?: number };

export function formatDuration(ms: number): string {
  if (ms < 100) return `${Math.round(ms)}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Numbered `01` steps with real timings; a polite live region. */
export function StepList({ steps }: { steps: Step[] }) {
  return (
    <div role="status" aria-live="polite">
      <ol className="bc-st">
        {steps.map((s, i) => (
          <li key={i} data-state={s.state}>
            <span className="bc-n" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            <span className="bc-m" aria-hidden="true" />
            <span>
              {s.label}
              <span className="bc-sr"> · {s.state}</span>
              {s.detail && <span className="bc-sub">{s.detail}</span>}
            </span>
            {s.ms !== undefined ? <span className="bc-x">{formatDuration(s.ms)}</span> : <span />}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Wall clock that re-renders every `intervalMs` (0 = off); `null` until mounted so SSR and hydration agree. */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (intervalMs <= 0) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** `21:04:17 UTC · 4s ago` in a <time datetime>. */
export function TimeValue({ ms, relative, now }: { ms: number; relative?: boolean; now?: number }) {
  const ticking = useNow(relative && now === undefined ? 1000 : 0);
  const at = now ?? ticking;
  return (
    <time dateTime={new Date(ms).toISOString()}>
      {utcClock(ms)}
      {relative && at !== null && ` · ${relativeAge(ms, at)} ago`}
    </time>
  );
}

/** `checked 8s ago` / dashed `stale · 2m` + retry / dashed `offline`. */
export function Freshness({
  lastSuccessAt,
  staleAfterMs,
  now,
  refreshing,
  offline,
  onRetry,
}: {
  lastSuccessAt: number | null;
  staleAfterMs: number;
  now?: number;
  refreshing?: boolean;
  offline?: boolean;
  onRetry?: () => void;
}) {
  const ticking = useNow(now === undefined ? 1000 : 0);
  const at = now ?? ticking;
  const retry = onRetry && (
    <Button variant="ghost" size="sm" onClick={onRetry} busy={refreshing}>
      retry
    </Button>
  );
  if (offline || lastSuccessAt === null) {
    return (
      <span className="bc-row" aria-busy={refreshing || undefined}>
        <StatusTag status="offline" />
        {retry}
      </span>
    );
  }
  if (at === null) return <span className="bc-hint mono">checked</span>;
  const age = relativeAge(lastSuccessAt, at);
  if (at - lastSuccessAt > staleAfterMs) {
    return (
      <span className="bc-row" aria-busy={refreshing || undefined}>
        <span className="bc-hint mono">as of {utcClock(lastSuccessAt)}</span>
        <StatusTag status="stale" detail={age} />
        {retry}
      </span>
    );
  }
  return (
    <span className="bc-hint mono" aria-busy={refreshing || undefined}>
      checked {age} ago
    </span>
  );
}
