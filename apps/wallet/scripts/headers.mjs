// Writes out/_headers (Cloudflare static assets) after `next build`. The export inlines its RSC
// payload as <script> blocks that change every build, so their hashes are collected here.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = new URL('../out/', import.meta.url).pathname;
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.bunkercoin.com/';

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(path);
    return e.name.endsWith('.html') ? [path] : [];
  });
}

const hashes = new Set();
const inline = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
for (const file of htmlFiles(OUT)) {
  const html = readFileSync(file, 'utf8');
  for (const [, body] of html.matchAll(inline)) {
    if (body) hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  // 404.html is Next's fallback page; with SPA not-found handling it is never served.
  if (!file.endsWith('404.html') && /<style[\s>]|\sstyle="/i.test(html)) {
    console.warn(`headers: ${file} has inline styles, which the CSP blocks`);
  }
}

const csp = [
  "default-src 'self'",
  // hash-wasm compiles its Argon2 WebAssembly at runtime.
  `script-src 'self' 'wasm-unsafe-eval' ${[...hashes].sort().join(' ')}`.trim(),
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${new URL(rpcUrl).origin}`,
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const headers = `/*
  Content-Security-Policy: ${csp}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
`;

writeFileSync(join(OUT, '_headers'), headers);
console.log(`headers: wrote out/_headers with ${hashes.size} inline script hashes, connect-src ${new URL(rpcUrl).origin}`);
