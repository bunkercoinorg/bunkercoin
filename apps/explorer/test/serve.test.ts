import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { ReadStream } from 'node:fs';
import { get } from 'node:http';
import { candidates, serveStatic } from '../scripts/serve.ts';

let dir = '';
let base = '';
let close = () => {};

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'explorer-out-'));
  await mkdir(join(dir, '_next', 'static'), { recursive: true });
  await writeFile(join(dir, 'index.html'), 'home');
  await writeFile(join(dir, 'block.html'), 'block');
  await writeFile(join(dir, '404.html'), 'missing');
  await writeFile(join(dir, '_next', 'static', 'app.js'), 'js');
  const server = serveStatic(dir);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

after(async () => {
  close();
  await rm(dir, { recursive: true, force: true });
});

test('paths outside the root are refused', () => {
  const root = '/srv/out';
  assert.deepEqual(candidates(root, '/../../etc/passwd'), ['/srv/out/etc/passwd', '/srv/out/etc/passwd.html', '/srv/out/etc/passwd/index.html']);
  assert.equal(candidates(root, '/%2e%2e/%2e%2e/etc/passwd')?.[0], '/srv/out/etc/passwd');
  assert.equal(candidates(root, '/a%00b'), null);
  assert.equal(candidates(root, '/%E0%A4%A'), null);
});

test('export routes resolve without the .html suffix and keep their query', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.equal(await home.text(), 'home');
  const block = await fetch(`${base}/block?id=42`);
  assert.equal(await block.text(), 'block');
  assert.match(block.headers.get('content-type') ?? '', /text\/html/);
  assert.equal(block.headers.get('cache-control'), 'no-cache');
});

test('hashed assets are immutable and unknown paths get the 404 page', async () => {
  const js = await fetch(`${base}/_next/static/app.js`);
  assert.match(js.headers.get('cache-control') ?? '', /immutable/);
  assert.match(js.headers.get('content-type') ?? '', /javascript/);
  const missing = await fetch(`${base}/nope`);
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'missing');
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
});

test('disconnecting mid-download closes the file stream', { timeout: 5000 }, async (t) => {
  const file = join(dir, 'large.bin');
  await writeFile(file, Buffer.alloc(16 * 1024 * 1024));
  const reads = t.mock.method(ReadStream.prototype, '_read');
  const opened = () => reads.mock.calls.map((c) => c.this as ReadStream).filter((s) => s.path === file);
  t.after(() => opened().forEach((s) => s.destroy()));
  await new Promise<void>((resolve, reject) => {
    const req = get(`${base}/large.bin`, (res) => {
      res.once('data', () => {
        res.destroy();
        resolve();
      });
      res.once('error', reject);
    });
    req.once('error', reject);
  });
  const [stream] = opened();
  assert.ok(stream);
  assert.ok(stream.bytesRead < 16 * 1024 * 1024);
  if (!stream.closed) await new Promise<void>((resolve) => stream.once('close', () => resolve()));
  assert.equal(stream.closed, true);
  assert.equal(stream.destroyed, true);
});
