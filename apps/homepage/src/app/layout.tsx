import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});


export const metadata: Metadata = {
    title: "BunkerCoin",
    description: "The first blockchain on radiowaves, working without internet.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <html lang="en">
        <body className={`${inter.variable} antialiased bg-neutral-950 text-white `}>
        {children}
        </body>
        </html>
    );
}