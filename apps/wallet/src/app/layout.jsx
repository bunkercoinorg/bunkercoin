import './globals.css';

export const metadata = {
  title: 'BunkerCoin Wallet',
  description: 'Local-only wallet for the BunkerCoin testnet',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
