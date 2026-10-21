'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { formatUnits, shortId } from '@bunkercoin/chain-format';
import { Icon, type IconName } from './icons.tsx';
import { Link } from './link.tsx';
import { Button } from './controls.tsx';

const vars = (v: Record<string, string | number | undefined>) => v as CSSProperties;

export type PanelTone = 'default' | 'receipt' | 'danger';

/** 40px surface bar + body. `receipt` = the riveted signed-receipt frame; `danger` adds a danger left rule. */
export function Panel({
  title,
  meta,
  actions,
  tone = 'default',
  footer,
  flush,
  children,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tone?: PanelTone;
  footer?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="bc-pn" data-tone={tone === 'default' ? undefined : tone} aria-labelledby={title ? id : undefined}>
      {(title || meta || actions) && (
        <div className="bc-pn-h">
          {title ? (
            <h2 className="bc-lbl" id={id}>
              {title}
            </h2>
          ) : (
            <span className="bc-grow" />
          )}
          {meta && <span className="bc-meta">{meta}</span>}
          {actions}
        </div>
      )}
      <div className="bc-pn-b" data-flush={flush ? '' : undefined}>
        {children}
      </div>
      {footer && <div className="bc-pn-f">{footer}</div>}
    </section>
  );
}

export type Fact = { label: ReactNode; value: ReactNode; wide?: boolean; strong?: boolean; changed?: boolean };

/** Semantic <dl>. `cells`: gap-px grid; `rows`: label | value ledger (the receipt). */
export function Facts({
  items,
  columns = 2,
  variant = 'cells',
  phoneColumns,
}: {
  items: Fact[];
  columns?: 1 | 2 | 3;
  variant?: 'cells' | 'rows';
  phoneColumns?: 1 | 2;
}) {
  return (
    <dl className="bc-fx" data-variant={variant === 'rows' ? 'rows' : undefined} data-phone-columns={phoneColumns} style={vars({ '--c': columns })}>
      {items.map((f, i) => (
        <div key={i} data-wide={f.wide ? '' : undefined} data-strong={f.strong ? '' : undefined} data-changed={f.changed ? '' : undefined}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Gap-px cell grid (validators). */
export function Cells({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <div className="bc-cells" style={vars({ '--c': columns })}>
      {children}
    </div>
  );
}

export function Cell({ children, isNew }: { children: ReactNode; isNew?: boolean }) {
  return <div data-new={isNew ? '' : undefined}>{children}</div>;
}

/** Exact bigint amount: `null` renders `–`; fraction digits in --ink; `+` incoming in --acc. */
export function Amount({
  units,
  scale,
  symbol,
  sign,
  size = 'row',
}: {
  units: bigint | null;
  scale: 0 | 6;
  symbol?: string;
  sign?: '+' | '-';
  size?: 'balance' | 'row';
}) {
  const Tag = size === 'balance' ? 'div' : 'span';
  const cls = size === 'balance' ? 'bc-bal' : 'bc-amt';
  if (units === null) {
    return (
      <Tag className={cls}>
        <span aria-hidden="true">–</span>
        <span className="bc-sr">unknown</span>
      </Tag>
    );
  }
  const shownSign = sign ?? (units < 0n ? '-' : undefined);
  const text = formatUnits(units < 0n ? -units : units, scale);
  const [whole, frac] = text.split('.');
  const prefix = shownSign === '+' ? '+' : shownSign === '-' ? '−' : '';
  if (size === 'balance') {
    return (
      <div className={cls} data-long={text.length > 13 ? '' : undefined}>
        {prefix}
        {whole}
        {frac && <span className="bc-fr">.{frac}</span>}
        {symbol && <span className="bc-u">{symbol}</span>}
      </div>
    );
  }
  return (
    <span className={cls} data-sign={shownSign}>
      {prefix}
      {whole}
      {frac && <span className="bc-fr">.{frac}</span>}
      {symbol && ` ${symbol}`}
    </span>
  );
}

/** Hero wrapper for the balance: centred, unit below. */
export function BalanceHero({ children }: { children: ReactNode }) {
  return <div className="bc-hero">{children}</div>;
}

type CopyState = 'idle' | 'ok' | 'failed';

/**
 * The value is the copy control (awaits the clipboard write): check + `copied` for 1.4s, or danger +
 * `copy failed · select it` for 3s with the value left selectable. With `href` the value navigates
 * and only the icon copies. `short` = 4…4 (hex 6…4), `full` wraps anywhere, `box` = receive frame.
 */
export function CopyValue({
  value,
  mode = 'short',
  href,
  label,
  external,
}: {
  value: string;
  mode?: 'short' | 'full' | 'box';
  href?: string;
  /** What the value is, for the accessible name (`copy address 8Ep5…suHx`). */
  label?: string;
  external?: boolean;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  const shown = mode === 'short' ? shortId(value) : value;
  const copy = async () => {
    clearTimeout(timer.current);
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = false;
    }
    if (!live.current) return;
    setState(ok ? 'ok' : 'failed');
    timer.current = setTimeout(() => setState('idle'), ok ? 1400 : 3000);
  };
  const name = `copy ${label ? `${label} ` : ''}${shown}`;
  const tail = state === 'ok' ? 'copied' : state === 'failed' ? 'copy failed · select it' : '';
  const icon = <Icon name={state === 'ok' ? 'check' : 'copy'} />;
  const status = (
    <span className="bc-sr" role="status">
      {tail}
    </span>
  );
  if (href) {
    return (
      <span className="bc-cvw">
        <Link className="bc-lnk" href={href} external={external}>
          {shown}
        </Link>
        <button type="button" className="bc-cv" data-icon-only="" data-state={state} title={`copy ${value}`} aria-label={name} onClick={copy}>
          {icon}
          {tail && (
            <span className="bc-t" aria-hidden="true">
              {tail}
            </span>
          )}
        </button>
        {status}
      </span>
    );
  }
  return (
    <span className="bc-cvw">
      <button type="button" className="bc-cv" data-mode={mode} data-state={state} title={`copy ${value}`} aria-label={name} onClick={copy}>
        <span className="bc-v">{shown}</span>
        {icon}
        {tail && (
          <span className="bc-t" aria-hidden="true">
            {tail}
          </span>
        )}
      </button>
      {status}
    </span>
  );
}

/** Address chip for the wallet header. */
export function AddressChip({ address }: { address: string }) {
  return (
    <span className="bc-chip">
      <CopyValue value={address} label="address" />
    </span>
  );
}

/** <details> with `+` / `–`: `details`, `hex`, `metadata · optional`. */
export function Disclosure({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="bc-more" open={open}>
      <summary>{summary}</summary>
      <div className="bc-more-b">{children}</div>
    </details>
  );
}

/** 76px home tile: icon over a one-word label; dashed when disabled. */
export function ActionTile({
  icon,
  label,
  disabled,
  primary,
  onClick,
  href,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  primary?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <Icon name={icon} />
      <span>{label}</span>
    </>
  );
  const p = primary ? '' : undefined;
  if (href && !disabled) {
    return (
      <Link className="bc-tile" href={href} data-primary={p}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className="bc-tile" data-primary={p} disabled={disabled} onClick={onClick}>
      {inner}
    </button>
  );
}

export function ActionTiles({ children, label = 'actions' }: { children: ReactNode; label?: string }) {
  return (
    <div className="bc-qa" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function List({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="bc-tl" aria-label={label}>
      {children}
    </ul>
  );
}

/** 64px row: 36px mark, title over a dim mono line, tabular value right. Tag only while not final. */
export function ListRow({
  mark,
  title,
  sub,
  value,
  valueSub,
  tag,
  href,
  onClick,
}: {
  mark: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  value: ReactNode;
  valueSub?: ReactNode;
  tag?: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="bc-tm" aria-hidden="true">
        {mark}
      </span>
      <span className="bc-lr-m">
        <span className="bc-nm">{title}</span>
        {sub && <span className="bc-sub">{sub}</span>}
      </span>
      <span className="bc-r">
        {value}
        {tag ?? (valueSub && <span className="bc-sub">{valueSub}</span>)}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link className="bc-lr" href={href}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" className="bc-lr" onClick={onClick}>
          {inner}
        </button>
      ) : (
        <div className="bc-lr">{inner}</div>
      )}
    </li>
  );
}

/** Date group label between lists (`today`, `21 oct`). */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <h3 className="bc-grp">{children}</h3>;
}

export function ChoiceList({ children }: { children: ReactNode }) {
  return <div className="bc-choices">{children}</div>;
}

/** Big choice row (welcome: create vs import). */
export function Choice({
  icon,
  title,
  line,
  primary,
  href,
  onClick,
}: {
  icon: IconName;
  title: ReactNode;
  line?: ReactNode;
  primary?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="bc-tm" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span>
        <b>{title}</b>
        {line && <span className="bc-s">{line}</span>}
      </span>
      <Icon name="chev" />
    </>
  );
  const p = primary ? '' : undefined;
  return href ? (
    <Link className="bc-choice" href={href} data-primary={p}>
      {inner}
    </Link>
  ) : (
    <button type="button" className="bc-choice" data-primary={p} onClick={onClick}>
      {inner}
    </button>
  );
}

export type SettingsRow = { label: ReactNode; value?: ReactNode; danger?: boolean; href?: string; onClick?: () => void };

/** 60px rows, value right, chevron. */
export function SettingsList({ rows }: { rows: SettingsRow[] }) {
  return (
    <ul className="bc-slist">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="bc-nm">{r.label}</span>
            <span className="bc-val">{r.value}</span>
            <Icon name="chev" />
          </>
        );
        const d = r.danger ? '' : undefined;
        return (
          <li key={i}>
            {r.href ? (
              <Link href={r.href} data-danger={d}>
                {inner}
              </Link>
            ) : (
              <button type="button" data-danger={d} onClick={r.onClick}>
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type PaginationState = 'idle' | 'loading' | 'error' | 'end';

/** Explicit `load older`: never advances on a failed fetch. */
export function Pagination({
  state,
  onMore,
  note,
  labels = {},
}: {
  state: PaginationState;
  onMore: () => void;
  note?: ReactNode;
  labels?: { more?: string; loading?: string; error?: string; end?: string };
}) {
  return (
    <div className="bc-pg" aria-live="polite">
      {note && <span className="bc-grow">{note}</span>}
      {state === 'idle' && (
        <Button variant="ghost" size="sm" onClick={onMore}>
          {labels.more ?? 'load older'}
        </Button>
      )}
      {state === 'loading' && (
        <Button variant="ghost" size="sm" busy>
          {labels.loading ?? 'loading older…'}
        </Button>
      )}
      {state === 'error' && (
        <>
          <span>{labels.error ?? 'Older entries unavailable'}</span>
          <Button variant="ghost" size="sm" onClick={onMore}>
            retry
          </Button>
        </>
      )}
      {state === 'end' && <span>{labels.end ?? 'end of history'}</span>}
    </div>
  );
}
