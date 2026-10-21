'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell, applyTheme, Footer, Link, LinkProvider, readTheme, Tag, ThemeControl, type Theme } from '@bunkercoin/ui';
import { SOURCE_URL, WALLET_URL } from '@/lib/config';
import LiveFeed from './live-feed';
import { HeaderSiteSearch } from './site-search';

const NAV = [
  { label: 'overview', href: '/' },
  { label: 'blocks', href: '/blocks' },
  { label: 'tokens', href: '/tokens' },
  { label: 'network', href: '/network' },
  { label: 'stream', href: '/stream' },
];

// Detail pages belong to the list they came from.
const SECTION: Record<string, string> = { '/block': '/blocks', '/tx': '/blocks', '/token': '/tokens' };

function ExplorerTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => setTheme(readTheme('dark')), []);
  return (
    <details className="theme-menu">
      <summary>theme</summary>
      <div>
        <ThemeControl
          value={theme}
          onChange={(t) => {
            setTheme(t);
            applyTheme(t);
          }}
        />
      </div>
    </details>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = (usePathname() || '/').replace(/\/+$/, '') || '/';
  const section = SECTION[path] ?? path;
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
