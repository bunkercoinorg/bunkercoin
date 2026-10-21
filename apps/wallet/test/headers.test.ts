import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHeaders, inlineScriptHashes, inlineStyleFindings } from '../scripts/headers.mjs';

const SCRIPT = new URL('../scripts/headers.mjs', import.meta.url).pathname;

function app(html: string, env: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'wallet-headers-'));
  mkdirSync(join(root, 'out'));
  writeFileSync(join(root, 'out', 'index.html'), html);
  for (const [name, body] of Object.entries(env)) writeFileSync(join(root, name), body);
  return root;
}

const cleanEnv = () => {
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_RPC_URL;
  delete env.NEXT_PUBLIC_METADATA_URL;
  return env;
};

test('inline scripts are hashed; external and empty ones are not', () => {
  const body = 'self.__next_f.push([1,"x"])';
  const hashes = inlineScriptHashes([`<script src="/a.js"></script><script></script><script>${body}</script><script>${body}</script>`]);
  assert.deepEqual(hashes, [`'sha256-${createHash('sha256').update(body).digest('base64')}'`]);
  const headers = buildHeaders({ hashes, rpcUrl: 'https://node.example:8899/rpc' });
  assert.match(headers, /connect-src 'self' https:\/\/node\.example:8899;/);
  assert.match(headers, /img-src 'self' data:;/);
  const enabled = buildHeaders({ hashes, rpcUrl: 'https://node.example:8899/rpc', metadataUrl: 'https://metadata.bunkercoin.com' });
  assert.match(enabled, /connect-src 'self' https:\/\/node\.example:8899 https:\/\/metadata\.bunkercoin\.com;/);
  assert.match(enabled, /img-src 'self' data: blob: https:\/\/metadata\.bunkercoin\.com;/);
});

test('an unset metadata URL keeps the metadata origin out of the written CSP', () => {
  const root = app('<script>boot()</script>', { '.env.local': 'NEXT_PUBLIC_RPC_URL=https://custom.example:8899/\n' });
  execFileSync(process.execPath, [SCRIPT, root], { env: cleanEnv(), stdio: 'pipe' });
  const headers = readFileSync(join(root, 'out', '_headers'), 'utf8');
  assert.match(headers, /connect-src 'self' https:\/\/custom\.example:8899;/);
  assert.match(headers, /img-src 'self' data:;/);
  assert.doesNotMatch(headers, /metadata|blob:/);
});

test('the metadata origin is listed once in connect-src and img-src', () => {
  const headers = buildHeaders({ hashes: ["'sha256-x'"], rpcUrl: 'https://meta.example/rpc', metadataUrl: 'https://meta.example/' });
  assert.match(headers, /connect-src 'self' https:\/\/meta\.example;/);
  assert.match(headers, /img-src 'self' data: blob: https:\/\/meta\.example;/);
});

test('connect-src follows the .env file the build used, in production mode', () => {
  const root = app('<script>boot()</script>', {
    '.env.local': 'NEXT_PUBLIC_RPC_URL=https://custom.example:8899/\nNEXT_PUBLIC_METADATA_URL=http://localhost:8787\n',
    '.env.development.local': 'NEXT_PUBLIC_RPC_URL=https://dev-only.example/\nNEXT_PUBLIC_METADATA_URL=https://dev-meta.example\n',
  });
  execFileSync(process.execPath, [SCRIPT, root], { env: cleanEnv(), stdio: 'pipe' });
  const headers = readFileSync(join(root, 'out', '_headers'), 'utf8');
  assert.match(headers, /connect-src 'self' https:\/\/custom\.example:8899 http:\/\/localhost:8787;/);
  assert.match(headers, /img-src 'self' data: blob: http:\/\/localhost:8787;/);
  assert.match(headers, /'sha256-[^']+'/);
});

test('a build with no inline script hashes fails instead of shipping a blocking CSP', () => {
  const root = app('<html><script src="/app.js"></script></html>', {});
  const run = spawnSync(process.execPath, [SCRIPT, root], { env: cleanEnv(), encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /no inline scripts/);
});

test('inline style emission paths in the export are found; framework-owned ones are not', () => {
  const chunk = (path: string, text: string) => ({ path: `out/_next/static/chunks/${path}`, text });
  const found = inlineStyleFindings([
    { path: 'out/index.html', text: '<div style="min-width:80px"></div>' },
    { path: 'out/404.html', text: '<style>body{}</style>' },
    chunk('app/page-1.js', '(0,r.jsx)("button",{type:l,"aria-busy":o||void 0,style:o&&c.current?{minWidth:c.current}:d,'),
    chunk('app/page-2.js', '(0,r.jsx)("p",{style:{color:"red"},children:t})'),
    chunk('12-3.js', 'e.setAttribute("style","color:red")'),
    chunk('app/layout-4.js', 'e.exports={style:{fontFamily:"\'GeistSans\'"},className:"__className_8adcd2"}'),
    chunk('main-5.js', '(0,o.jsx)("p",{id:"__next-route-announcer__",style:l,children:t})'),
    chunk('6-7.js', '"Application error: a ",r?"server":"client",(0,o.jsx)("h2",{style:c.text,children:[]})'),
    chunk('app/page-8.js', '(0,r.jsx)("button",{className:"bc-btn","aria-busy":o||void 0,children:t})'),
  ]);
  assert.deepEqual(
    found.map((f) => f.split(':')[0]),
    ['out/index.html', 'out/_next/static/chunks/app/page-1.js', 'out/_next/static/chunks/app/page-2.js', 'out/_next/static/chunks/12-3.js'],
  );
});
