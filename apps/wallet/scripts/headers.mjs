// Writes out/_headers (Cloudflare static assets) after `next build`. The export inlines its RSC
// payload as <script> blocks that change every build, so their hashes are collected here.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_RPC_URL = 'https://rpc.bunkercoin.com/';

/** The env Next itself compiled in: same loader (resolved through next), same .env* files, production mode. */
export function loadBuildEnv(dir) {
  const fromNext = createRequire(createRequire(import.meta.url).resolve('next/package.json'));
  fromNext('@next/env').loadEnvConfig(dir, false, { info: () => {}, error: console.error });
  return process.env;
}

export function inlineScriptHashes(htmls) {
  const hashes = new Set();
  const inline = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const html of htmls) {
    for (const [, body] of html.matchAll(inline)) {
      if (body) hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
  }
  return [...hashes].sort();
}

export function buildHeaders({ hashes, rpcUrl }) {
  const csp = [
    "default-src 'self'",
    // hash-wasm compiles its Argon2 WebAssembly at runtime.
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`.trim(),
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
  return `/*
  Content-Security-Policy: ${csp}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
`;
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(path);
    return e.name.endsWith('.html') ? [path] : [];
  });
}

function main(root = fileURLToPath(new URL('..', import.meta.url))) {
  const out = join(root, 'out');
  const rpcUrl = loadBuildEnv(root).NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL;
  const files = htmlFiles(out);
  const htmls = files.map((f) => readFileSync(f, 'utf8'));
  files.forEach((file, i) => {
    // 404.html is Next's fallback page; with SPA not-found handling it is never served.
    if (!file.endsWith('404.html') && /<style[\s>]|\sstyle="/i.test(htmls[i])) {
      console.warn(`headers: ${file} has inline styles, which the CSP blocks`);
    }
  });
  const hashes = inlineScriptHashes(htmls);
  // A CSP without the flight-script hashes blocks hydration: a blank wallet, so fail the build instead.
  if (hashes.length === 0) {
    console.error(`headers: no inline scripts found in ${out}; refusing to write a CSP that blocks the app`);
    process.exit(1);
  }
  writeFileSync(join(out, '_headers'), buildHeaders({ hashes, rpcUrl }));
  console.log(`headers: wrote out/_headers with ${hashes.length} inline script hashes, connect-src ${new URL(rpcUrl).origin}`);
}

// Optional argument: the app root (default: this package), whose out/ and .env* files are used.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2]);
