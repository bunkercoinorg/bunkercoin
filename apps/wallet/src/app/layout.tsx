import type { Viewport } from 'next';
import { fontClassName } from '@bunkercoin/ui/fonts';
import { THEME_COLORS, themeInitScript } from '@bunkercoin/ui';
import './globals.css';

const description = 'Local-only wallet for the BunkerCoin testnet';

export const metadata = {
  metadataBase: new URL('https://wallet.bunkercoin.com'),
  title: 'BunkerCoin wallet',
  description,
  openGraph: {
    title: 'BunkerCoin wallet',
    description,
    url: 'https://wallet.bunkercoin.com',
    siteName: 'BunkerCoin wallet',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'BunkerCoin wallet', description, images: ['/og.png'] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontClassName} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript('system') }} />
      </head>
      <body>
        {/* WebCrypto needs a secure context: hop to https before anything runs. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/https-redirect.js" />
        {children}
      </body>
    </html>
  );
}
