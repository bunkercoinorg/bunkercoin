'use client';

import type { ReactNode } from 'react';
import { BrandMark, Icon, Sprite, type IconName } from './icons.tsx';
import { Link } from './link.tsx';
import { Button } from './controls.tsx';

export type NavItem = { label: string; href: string; current?: boolean; external?: boolean };

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** Centred column with the 1px rails; rails drop below 48rem. */
export function Wrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('bc-wrap', className)}>{children}</div>;
}

/** Full-bleed hairline with rivets at both rails. */
export function Rule({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cx('bc-rule', className)}>{children}</div>;
}

export function SkipLink({ target = 'main', children = 'skip to content' }: { target?: string; children?: ReactNode }) {
  return (
    <a className="bc-skip" href={`#${target}`}>
      {children}
    </a>
  );
}

export function Nav({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav className="bc-nav" aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} external={item.external} aria-current={item.current ? 'page' : undefined}>
          {item.external ? `${item.label} ↗` : item.label}
        </Link>
      ))}
    </nav>
  );
}

export type HeaderProps = {
  app: 'wallet' | 'explorer';
  nav?: NavItem[];
  /** Right-aligned tools (address chip, lock, theme, `wallet ↗`). */
  tools?: ReactNode;
  /** Network tag beside the brand (`private testnet`); hidden on phones. */
  status?: ReactNode;
  /** Explorer header search; wraps to its own row on phones. */
  search?: ReactNode;
  /** Focused wallet step: the header is hidden on phones, the flow bar replaces it. */
  flow?: boolean;
  brandHref?: string;
};

export function Header({ app, nav, tools, status, search, flow, brandHref = '/' }: HeaderProps) {
  return (
    <header className="bc-hd" data-flow={flow ? '' : undefined}>
      <div className={cx('bc-wrap', 'bc-hd-in', !!search && 'bc-has-search')}>
        <Link className="bc-brand" href={brandHref} aria-label={`BunkerCoin ${app}`}>
          <BrandMark />
          <span>BunkerCoin</span>
          <small>{app}</small>
        </Link>
        {status}
        {nav && nav.length > 0 && <Nav items={nav} label={app} />}
        <div className="bc-tools">{tools}</div>
        {search}
      </div>
    </header>
  );
}

export function Footer({ children, links }: { children?: ReactNode; links?: NavItem[] }) {
  return (
    <footer className="bc-ft">
      <div className="bc-wrap bc-ft-in">
        <span className="bc-brand">
          <BrandMark />
          <span>BunkerCoin</span>
        </span>
        {children && <span>{children}</span>}
        {links && links.length > 0 && (
          <nav aria-label="footer">
            {links.map((l) => (
              <Link key={l.href} href={l.href} external={l.external}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </footer>
  );
}

export type AppShellProps = HeaderProps & {
  children: ReactNode;
  /** Bar under the header: offline / API unavailable. */
  banner?: ReactNode;
  footer?: ReactNode;
  /** Wallet phone tab bar. */
  tabBar?: ReactNode;
  mainId?: string;
};

export function AppShell({ children, banner, footer, tabBar, mainId = 'main', ...header }: AppShellProps) {
  return (
    <div className="bc-app" data-app={header.app}>
      <Sprite />
      <SkipLink target={mainId} />
      <Header {...header} />
      {banner}
      <main id={mainId} className="bc-main" tabIndex={-1}>
        <Wrap>{children}</Wrap>
      </main>
      {footer}
      {tabBar}
    </div>
  );
}

export type TabItem = { label: string; href: string; icon: IconName };

const WALLET_TABS: TabItem[] = [
  { label: 'home', href: '#home', icon: 'home' },
  { label: 'activity', href: '#activity', icon: 'activity' },
  { label: 'settings', href: '#settings', icon: 'settings' },
];

/** Phone-only bottom navigation (wallet home, activity, settings). */
export function TabBar({ current, items = WALLET_TABS, label = 'wallet' }: { current: string; items?: TabItem[]; label?: string }) {
  return (
    <nav className="bc-tabbar" aria-label={label}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.label === current ? 'page' : undefined}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Focused step header: back, step name, `2 / 3`. */
export function FlowBar({ title, step, onBack, backLabel = 'back' }: { title: string; step?: [number, number]; onBack?: () => void; backLabel?: string }) {
  return (
    <div className="bc-fb">
      {onBack ? (
        <Button variant="ghost" size="sm" iconOnly aria-label={backLabel} onClick={onBack}>
          <Icon name="back" />
        </Button>
      ) : (
        <span />
      )}
      <p className="bc-fb-t">{title}</p>
      {step ? (
        <span className="bc-fb-s">
          <span aria-hidden="true">
            {step[0]} / {step[1]}
          </span>
          <span className="bc-sr">
            step {step[0]} of {step[1]}
          </span>
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

/** Explorer detail pages: `← blocks`. */
export function BackLink({ label, href }: { label: string; href: string }) {
  return (
    <Link className="bc-back" href={href}>
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}

/** Bar under the header: `Offline. Can't reach …` + retry. `danger` for the explorer API-offline wash. */
export function Banner({ tone = 'neutral', children, action }: { tone?: 'neutral' | 'danger'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="bc-banner" data-tone={tone} role="status">
      <div className="bc-wrap bc-row">
        <span className="bc-grow">{children}</span>
        {action}
      </div>
    </div>
  );
}

/** Page heading block; the title is the view's one h1 and ends with a period. */
export function PageIntro({ label, title, lead, actions, center }: { label?: ReactNode; title: ReactNode; lead?: ReactNode; actions?: ReactNode; center?: boolean }) {
  return (
    <div className={cx('bc-intro', center && 'bc-ctr')}>
      {label && <p className="bc-lbl">{label}</p>}
      <h1 className="bc-t1">{title}</h1>
      {lead && <p className="bc-lead">{lead}</p>}
      {actions && <div className="bc-acts">{actions}</div>}
    </div>
  );
}

/** Section label over a list (`tokens`, `activity` + `all →`). */
export function SectionHead({ label, action, id }: { label: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="bc-sh">
      <h2 className="bc-lbl" id={id}>
        {label}
      </h2>
      {action}
    </div>
  );
}
