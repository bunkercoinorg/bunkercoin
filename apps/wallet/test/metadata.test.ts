import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  clearMetadataCache,
  encodeIcon,
  fetchVerifiedMetadata,
  localDocument,
  METADATA_URL,
  MetadataError,
  metadataHash,
  metadataHashBytes,
  metadataImageUrl,
  metadataTextProblem,
  promoteMetadata,
  squareCrop,
  uploadMetadata,
  type MetadataDocument,
} from '../src/lib/metadata.ts';

const VECTOR = '3fac357e74836eeb1811034d4c8b7381c54421ab04e73a6134d5cb7fe745d4fb';
const doc: MetadataDocument = { v: 1, name: 'BunkerCoin', description: '', image: null };
const hex = (b: Uint8Array | Buffer) => createHash('sha256').update(b).digest('hex');

type Call = { url: string; init?: RequestInit };
function mockFetch(reply: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    return reply(call);
  }) as typeof fetch;
  return { impl, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const isCode = (code: string) => (e: unknown) => e instanceof MetadataError && e.code === code && e.message.length > 0;

test('defaults and pure helpers', async () => {
  assert.equal(METADATA_URL, 'https://metadata.bunkercoin.com');
  assert.equal(metadataImageUrl('ab'.repeat(32)), `https://metadata.bunkercoin.com/v1/images/${'ab'.repeat(32)}`);
  assert.throws(() => metadataImageUrl('../x'));
  assert.equal(await metadataHash(localDocument('BunkerCoin', '')), VECTOR);
  assert.equal(localDocument('é', '').name, 'é');
  assert.deepEqual(metadataHashBytes(VECTOR).slice(0, 2), Uint8Array.of(0x3f, 0xac));
  assert.equal(metadataHashBytes(VECTOR).length, 32);
  assert.throws(() => metadataHashBytes(VECTOR.toUpperCase()));
  assert.equal(metadataTextProblem('Radio Lab', 'x'.repeat(280)), null);
  assert.ok(metadataTextProblem('', ''));
  assert.ok(metadataTextProblem('a\nb', ''));
  assert.deepEqual(squareCrop(400, 300), { sx: 50, sy: 0, side: 300 });
  assert.deepEqual(squareCrop(300, 401), { sx: 0, sy: 50, side: 300 });
});

test('encodeIcon prefers PNG, falls back to WebP, refuses when nothing fits', async () => {
  const blob = (type: string, size: number) => new Blob([new Uint8Array(size)], { type });
  const small = await encodeIcon(async (type) => blob(type, 1000));
  assert.equal(small.type, 'image/png');
  const asked: (number | undefined)[] = [];
  const fallback = await encodeIcon(async (type, q) => {
    asked.push(q);
    return type === 'image/png' ? blob(type, 262144) : blob(type, q! > 0.7 ? 300000 : 200000);
  });
  assert.equal(fallback.type, 'image/webp');
  assert.deepEqual(asked, [undefined, 0.92, 0.8, 0.65]);
  // Safari encodes PNG when asked for WebP; that must not count as a WebP icon.
  await assert.rejects(encodeIcon(async () => blob('image/png', 300000)), isCode('image-too-large'));
});

test('uploadMetadata posts multipart and returns the verified document', async () => {
  const image = new Blob([Uint8Array.of(1, 2, 3)], { type: 'image/png' });
  const sha = hex(Buffer.from([1, 2, 3]));
  const served: MetadataDocument = { v: 1, name: 'Radio Lab', description: 'hi', image: { sha256: sha, type: 'image/png', width: 256, height: 256 } };
  const { impl, calls } = mockFetch(async () => json({ hash: await metadataHash(served), document: served }));
  const out = await uploadMetadata({ name: 'Radio Lab', description: 'hi', image }, undefined, impl);
  assert.deepEqual(out.document, served);
  assert.equal(out.hash, await metadataHash(served));
  assert.equal(calls[0].url, 'https://metadata.bunkercoin.com/v1/metadata');
  assert.equal(calls[0].init?.method, 'POST');
  const form = calls[0].init?.body as FormData;
  assert.deepEqual([...form.keys()], ['name', 'description', 'image']);
  assert.equal(form.get('description'), 'hi');
});

test('uploadMetadata refuses replies that do not match what was sent', async () => {
  const reply = (body: unknown) => mockFetch(() => json(body)).impl;
  const ok = { hash: VECTOR, document: doc };
  await assert.rejects(uploadMetadata({ name: 'BunkerCoin', description: '' }, undefined, reply({ ...ok, hash: 'ab'.repeat(32) })), isCode('mismatch'));
  await assert.rejects(uploadMetadata({ name: 'Other', description: '' }, undefined, reply(ok)), isCode('mismatch'));
  await assert.rejects(uploadMetadata({ name: 'BunkerCoin', description: 'x' }, undefined, reply(ok)), isCode('mismatch'));
  await assert.rejects(uploadMetadata({ name: 'BunkerCoin', description: '' }, undefined, reply({ hash: VECTOR, document: { ...doc, extra: 1 } })), isCode('mismatch'));
  const withImage = { ...doc, image: { sha256: 'ab'.repeat(32), type: 'image/png', width: 64, height: 64 } } as MetadataDocument;
  await assert.rejects(
    uploadMetadata({ name: 'BunkerCoin', description: '' }, undefined, reply({ hash: await metadataHash(withImage), document: withImage })),
    isCode('mismatch'),
  );
  await assert.rejects(
    uploadMetadata({ name: 'BunkerCoin', description: '', image: new Blob([Uint8Array.of(9)]) }, undefined, reply({ hash: await metadataHash(withImage), document: withImage })),
    isCode('mismatch'),
  );
  assert.deepEqual(await uploadMetadata({ name: 'BunkerCoin', description: '' }, undefined, reply(ok)), ok);
});

test('uploadMetadata maps service and network errors to copy, and lets aborts through', async () => {
  const fails = (status: number, code: string) => mockFetch(() => json({ error: 'x', code }, status)).impl;
  await assert.rejects(uploadMetadata({ name: 'a', description: '' }, undefined, fails(429, 'RATE_LIMITED')), isCode('rate-limited'));
  await assert.rejects(uploadMetadata({ name: 'a', description: '' }, undefined, fails(413, 'IMAGE_TOO_LARGE')), isCode('image-too-large'));
  await assert.rejects(uploadMetadata({ name: 'a', description: '' }, undefined, fails(400, 'INVALID_METADATA')), isCode('invalid'));
  await assert.rejects(uploadMetadata({ name: 'a', description: '' }, undefined, fails(500, 'INTERNAL_ERROR')), isCode('unavailable'));
  const offline = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;
  await assert.rejects(uploadMetadata({ name: 'a', description: '' }, undefined, offline), isCode('unavailable'));
  const aborted = (async () => {
    throw new DOMException('aborted', 'AbortError');
  }) as typeof fetch;
  await assert.rejects(uploadMetadata({ name: 'a', description: '' }, undefined, aborted), (e: unknown) => e instanceof DOMException && e.name === 'AbortError');
  const { impl, calls } = mockFetch(() => json({}));
  await assert.rejects(uploadMetadata({ name: '', description: '' }, undefined, impl), isCode('invalid'));
  await assert.rejects(uploadMetadata({ name: 'a', description: '', image: new Blob([new Uint8Array(262144)]) }, undefined, impl), isCode('image-too-large'));
  assert.equal(calls.length, 0);
});

test('fetchVerifiedMetadata verifies, caches hits only and never throws', async () => {
  clearMetadataCache();
  const good = mockFetch(() => new Response('{"description":"","image":null,"name":"BunkerCoin","v":1}'));
  assert.deepEqual(await fetchVerifiedMetadata(VECTOR, undefined, good.impl), doc);
  assert.deepEqual(await fetchVerifiedMetadata(VECTOR, undefined, good.impl), doc);
  assert.equal(good.calls.length, 1);
  assert.equal(good.calls[0].url, `https://metadata.bunkercoin.com/v1/metadata/${VECTOR}`);

  clearMetadataCache();
  const other = mockFetch(() => json({ ...doc, name: 'Other' }));
  assert.equal(await fetchVerifiedMetadata(VECTOR, undefined, other.impl), null);
  assert.equal(await fetchVerifiedMetadata(VECTOR, undefined, other.impl), null);
  assert.equal(other.calls.length, 2);
  assert.equal(await fetchVerifiedMetadata(VECTOR, undefined, mockFetch(() => json({ code: 'NOT_FOUND' }, 404)).impl), null);
  assert.equal(await fetchVerifiedMetadata(VECTOR, undefined, mockFetch(() => new Response('not json')).impl), null);
  const offline = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;
  assert.equal(await fetchVerifiedMetadata(VECTOR, undefined, offline), null);
  const never = mockFetch(() => json(doc));
  assert.equal(await fetchVerifiedMetadata('../../x', undefined, never.impl), null);
  assert.equal(never.calls.length, 0);
});

test('promoteMetadata issues one GET and swallows failures', async () => {
  clearMetadataCache();
  const { impl, calls } = mockFetch(() => json({ code: 'NOT_FOUND' }, 404));
  await promoteMetadata(VECTOR, impl);
  assert.equal(calls.length, 1);
  await promoteMetadata(VECTOR, (async () => {
    throw new TypeError('offline');
  }) as typeof fetch);
});
