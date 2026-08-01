import './globals.css';

export const metadata = {
  title: 'BunkerCoin Wallet',
  description: 'Local-only wallet for the BunkerCoin testnet',
  icons: {
    icon: '/bunker-favicon.png',
    shortcut: '/bunker-favicon.png',
    apple: '/bunker-favicon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
