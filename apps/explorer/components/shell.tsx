'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppShell, applyTheme, Footer, Link, LinkProvider, readTheme, syncThemeColor, Tag, ThemeControl, type Theme } from '@bunkercoin/ui';
import { SOURCE_URL, WALLET_URL } from '@/lib/config';
import LiveFeed from './live-feed';
import { HeaderSiteSearch } from './site-search';

const NAV = [
  { label: 'overview', href: '/' },
  { label: 'blocks', href: '/blocks' },
  { label: 'txs', href: '/txs' },
  { label: 'tokens', href: '/tokens' },
  { label: 'network', href: '/network' },
  { label: 'stream', href: '/stream' },
];

// Detail pages belong to the list they came from.
const SECTION: Record<string, string> = { '/block': '/blocks', '/tx': '/txs', '/token': '/tokens' };

function ExplorerTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const t = readTheme('dark');
    setTheme(t);
    syncThemeColor(t);
  }, []);
  const close = () => {
    if (!menu.current?.open) return;
    menu.current.open = false;
    menu.current.querySelector('summary')?.focus();
  };
  return (
    <details
      ref={menu}
      className="theme-menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <summary>theme</summary>
      <div>
        <ThemeControl
          value={theme}
          onChange={(t) => {
            setTheme(t);
            applyTheme(t);
            close();
          }}
        />
      </div>
    </details>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = (usePathname() || '/').replace(/\/+$/, '') || '/';
  const section = SECTION[path] ?? path;
  useEffect(() => {
    document.querySelector('.bc-nav [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [section]);
  return (
    <LinkProvider component={NextLink}>
      <AppShell
        app="explorer"
        nav={NAV.map((n) => ({ ...n, current: n.href === section }))}
        status={<Tag state="unknown">private testnet</Tag>}
        tools={
          <>
            <Link className="bc-mini" href={WALLET_URL} external>
              wallet ↗
            </Link>
            <ExplorerTheme />
          </>
        }
        search={path === '/' ? undefined : <HeaderSiteSearch />}
        banner={<LiveFeed />}
        footer={
          <Footer
            links={[
              { label: 'wallet', href: WALLET_URL, external: true },
              { label: 'source', href: SOURCE_URL, external: true },
            ]}
          >
            alpenglow over hf radio
          </Footer>
        }
      >
        {children}
      </AppShell>
    </LinkProvider>
  );
}
