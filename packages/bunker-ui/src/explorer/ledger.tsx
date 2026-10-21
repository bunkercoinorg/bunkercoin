'use client';

import { useId, type ReactNode } from 'react';
import { Button, TextInput } from '../controls.tsx';
import { Link } from '../link.tsx';

/** Facts ledger. `row` = one row of cells (overview: latest slot · finalized · checked). */
export function Ledger({ items, row }: { items: { label: ReactNode; value: ReactNode }[]; row?: boolean }) {
  return (
    <dl className="bc-ledger" data-row={row ? '' : undefined}>
      {items.map((it, i) => (
        <div key={i}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One-line summaries linking out (validators, radio link, lab camera). */
export function Summaries({ items }: { items: { label: ReactNode; value: ReactNode; sub?: ReactNode; href: string; external?: boolean }[] }) {
  return (
    <div className="bc-sums">
      {items.map((it) => (
        <Link key={it.href} href={it.href} external={it.external}>
          <span className="bc-lbl">{it.label}</span>
          <span className="bc-v">{it.value}</span>
          {it.sub && <span className="bc-s">{it.sub}</span>}
        </Link>
      ))}
    </div>
  );
}

/** `mempool → confirmed · slot 48,219 → finalized` with the current cell filled. */
export function Lifecycle({ steps, current }: { steps: { label: ReactNode; sub?: ReactNode }[]; current: number }) {
  return (
    <ol className="bc-life">
      {steps.map((s, i) => (
        <li key={i} data-state={i < current ? 'done' : i === current ? 'current' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span>{s.label}</span>
          {s.sub && <span className="bc-hint mono">{s.sub}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Holder share: 8px --line-soft track with a --dim fill, plus the percent as text. */
export function ShareBar({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <span>
      <svg className="bc-bar8" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <rect width={pct} height={8} />
      </svg>
      {label}
    </span>
  );
}

/** Buffered head rows: `3 new blocks · show`. */
export function NewRowsBar({ children, onShow, action = 'show' }: { children: ReactNode; onShow: () => void; action?: string }) {
  return (
    <div className="bc-newbar">
      <span className="bc-grow">{children}</span>
      <Button variant="quiet" size="sm" onClick={onShow}>
        {action}
      </Button>
    </div>
  );
}

/** Compact header search; a full-width row on phones. */
export function HeaderSearch({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder = 'slot, hash, address, token id',
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <form
      className="bc-hs"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="bc-sr" htmlFor={id}>
        search
      </label>
      <TextInput mono id={id} value={value} placeholder={placeholder} autoComplete="off" spellCheck={false} onChange={(e) => onChange(e.target.value)} />
      <Button variant="ghost" type="submit" busy={busy}>
        {busy ? 'searching…' : 'search'}
      </Button>
    </form>
  );
}
