// Writes out/_headers (Cloudflare static assets) after `next build`. The export inlines its RSC
// payload as <script> blocks that change every build, so their hashes are collected here.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Without a metadata URL the token metadata feature is off and its origin stays out of the CSP. */
export function buildHeaders({ hashes, rpcUrl, metadataUrl }) {
  const metadata = metadataUrl ? new URL(metadataUrl).origin : null;
  const csp = [
    "default-src 'self'",
    // hash-wasm compiles its Argon2 WebAssembly at runtime.
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`.trim(),
    "style-src 'self'",
    // blob: previews a picked token icon before upload.
    metadata ? `img-src 'self' data: blob: ${metadata}` : "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${[...new Set([new URL(rpcUrl).origin, metadata].filter(Boolean))].join(' ')}`,
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

function filesEnding(dir, ext) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return filesEnding(path, ext);
    return e.name.endsWith(ext) ? [path] : [];
  });
}

// Next's runtime chunks (route announcer, pages fallback), its built-in error and not-found screens, and next/font's
// `{style:{fontFamily}}` export are framework-owned; everything else is wallet code.
const FRAMEWORK_CHUNK = /\/(framework|main|polyfills|webpack)-[^/]*\.js$/;
const NEXT_ERROR_UI = /next-error-h1|"Application error: a "/;
const nearNextErrorUi = (text, i) => NEXT_ERROR_UI.test(text.slice(Math.max(0, i - 1500), i + 1500));
const STYLE_PROP = /[{,]style:(?!\{fontFamily:)/g;
const STYLE_ATTR = /setAttribute\(\s*["']style["']/g;

/** Paths that would emit a style attribute the CSP (`style-src 'self'`) blocks: HTML style attributes/blocks, and JSX `style` props or setAttribute('style') in app chunks. */
export function inlineStyleFindings(files) {
  const found = [];
  for (const { path, text } of files) {
    if (path.endsWith('.html')) {
      // 404.html is Next's fallback page; with SPA not-found handling it is never served.
      if (!path.endsWith('404.html') && /<style[\s>]|\sstyle="/i.test(text)) found.push(`${path}: inline style in HTML`);
    } else if (!FRAMEWORK_CHUNK.test(path)) {
      for (const m of text.matchAll(STYLE_PROP)) if (!nearNextErrorUi(text, m.index)) found.push(`${path}: style prop near ${JSON.stringify(text.slice(Math.max(0, m.index - 40), m.index + 30))}`);
      for (const m of text.matchAll(STYLE_ATTR)) found.push(`${path}: setAttribute('style') near ${JSON.stringify(text.slice(Math.max(0, m.index - 40), m.index + 30))}`);
    }
  }
  return found;
}

function main(root = fileURLToPath(new URL('..', import.meta.url))) {
  const out = join(root, 'out');
  const env = loadBuildEnv(root);
  const rpcUrl = env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL;
  const metadataUrl = env.NEXT_PUBLIC_METADATA_URL?.trim() || null;
  const files = filesEnding(out, '.html');
  const htmls = files.map((f) => readFileSync(f, 'utf8'));
  const chunks = (existsSync(join(out, '_next')) ? filesEnding(join(out, '_next'), '.js') : []).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  const styles = inlineStyleFindings([...files.map((path, i) => ({ path, text: htmls[i] })), ...chunks]);
  if (styles.length > 0) {
    console.error(`headers: inline styles the CSP blocks:\n  ${styles.join('\n  ')}`);
    process.exit(1);
  }
  const hashes = inlineScriptHashes(htmls);
  // A CSP without the flight-script hashes blocks hydration: a blank wallet, so fail the build instead.
  if (hashes.length === 0) {
    console.error(`headers: no inline scripts found in ${out}; refusing to write a CSP that blocks the app`);
    process.exit(1);
  }
  writeFileSync(join(out, '_headers'), buildHeaders({ hashes, rpcUrl, metadataUrl }));
  console.log(
    `headers: wrote out/_headers with ${hashes.length} inline script hashes, connect-src ${new URL(rpcUrl).origin}${metadataUrl ? ` ${new URL(metadataUrl).origin}` : ''}`,
  );
}

// Optional argument: the app root (default: this package), whose out/ and .env* files are used.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2]);
