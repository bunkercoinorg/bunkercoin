import type { Metadata, Viewport } from "next";
import { fontClassName } from "@bunkercoin/ui/fonts";
import { THEME_COLORS, themeInitScript } from "@bunkercoin/ui";
import "./globals.css";
import Providers from './providers';
import Shell from '@/components/shell';

const title = "BunkerCoin Explorer | Private Testnet";
const description =
  "Explore the BunkerCoin Private Testnet and watch the livestream. Running Alpenglow consensus on a shortwave radio network.";
const socialImage = {
  url: "/explorer-og.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "BunkerCoin Explorer Private Testnet with shortwave radio equipment",
};

export const metadata: Metadata = {
  title,
  description,
  
  // Favicon
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/bunker-favicon.png" }],
    apple: "/bunker-favicon.png",
  },
  
  // Open Graph metadata
  openGraph: {
    title,
    description,
    url: "https://explorer.bunkercoin.com/",
    siteName: "BunkerCoin Explorer",
    images: [socialImage],
    locale: "en_US",
    type: "website",
  },
  
  // Twitter Card metadata
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
    creator: "@bunkercoin_io",
  },
  
  // Additional metadata
  metadataBase: new URL("https://explorer.bunkercoin.com"),
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = { themeColor: THEME_COLORS.dark };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" className={fontClassName} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript('dark') }} />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
