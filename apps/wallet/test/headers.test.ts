import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHeaders, inlineScriptHashes } from '../scripts/headers.mjs';

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
  return env;
};

test('inline scripts are hashed; external and empty ones are not', () => {
  const body = 'self.__next_f.push([1,"x"])';
  const hashes = inlineScriptHashes([`<script src="/a.js"></script><script></script><script>${body}</script><script>${body}</script>`]);
  assert.deepEqual(hashes, [`'sha256-${createHash('sha256').update(body).digest('base64')}'`]);
  assert.match(buildHeaders({ hashes, rpcUrl: 'https://node.example:8899/rpc' }), /connect-src 'self' https:\/\/node\.example:8899;/);
});

test('connect-src follows the .env file the build used, in production mode', () => {
  const root = app('<script>boot()</script>', {
    '.env.local': 'NEXT_PUBLIC_RPC_URL=https://custom.example:8899/\n',
    '.env.development.local': 'NEXT_PUBLIC_RPC_URL=https://dev-only.example/\n',
  });
  execFileSync(process.execPath, [SCRIPT, root], { env: cleanEnv(), stdio: 'pipe' });
  const headers = readFileSync(join(root, 'out', '_headers'), 'utf8');
  assert.match(headers, /connect-src 'self' https:\/\/custom\.example:8899;/);
  assert.match(headers, /'sha256-[^']+'/);
});

test('a build with no inline script hashes fails instead of shipping a blocking CSP', () => {
  const root = app('<html><script src="/app.js"></script></html>', {});
  const run = spawnSync(process.execPath, [SCRIPT, root], { env: cleanEnv(), encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /no inline scripts/);
});
