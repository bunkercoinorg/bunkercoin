import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "./bc.css";

export const metadata: Metadata = {
    title: "BunkerCoin",
    description: "The blockchain that runs over shortwave radio. A private testnet runs today.",
    other: {
        "google": "notranslate",
    },
};

export const viewport: Viewport = { themeColor: "#090909", colorScheme: "dark" };

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" translate="no" className={`${GeistSans.variable} ${GeistMono.variable}`}>
            <body className="notranslate">{children}</body>
        </html>
    );
}
