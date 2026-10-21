import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex',
});

export const metadata = {
  metadataBase: new URL('https://wallet.bunkercoin.com'),
  title: 'BunkerCoin Wallet',
  description: 'Local-only wallet for the BunkerCoin testnet',
  icons: {
    icon: '/bunker-favicon.png',
    shortcut: '/bunker-favicon.png',
    apple: '/bunker-favicon.png',
  },
  openGraph: {
    title: 'BunkerCoin Wallet',
    description: 'Local-only wallet for the BunkerCoin testnet',
    url: 'https://wallet.bunkercoin.com',
    siteName: 'BunkerCoin Wallet',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BunkerCoin Wallet',
    description: 'Local-only wallet for the BunkerCoin testnet',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body>
        {/* WebCrypto needs a secure context — hop to https before anything runs. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/https-redirect.js" />
        {children}
      </body>
    </html>
  );
}
