import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

/** Put on <html>: defines --font-geist-sans / --font-geist-mono that tokens.css reads. Self-hosted, no network. */
export const fontClassName = `${GeistSans.variable} ${GeistMono.variable}`;

export { GeistMono, GeistSans };
