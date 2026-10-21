import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalMetadataJson, metadataHash, MetadataValidationError, validateMetadata, type MetadataDocument } from '../src/metadata.ts';

const base: MetadataDocument = { v: 1, name: 'BunkerCoin', description: '', image: null };
const img = { sha256: 'ab'.repeat(32), type: 'image/png', width: 256, height: 256 } as const;
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const rejects = (doc: unknown, what: string) =>
  assert.throws(() => validateMetadata(doc), (e: unknown) => e instanceof MetadataValidationError, what);

test('the README fixed vector', async () => {
  const json = canonicalMetadataJson(base);
  assert.equal(json, '{"description":"","image":null,"name":"BunkerCoin","v":1}');
  assert.equal(await metadataHash(base), '3fac357e74836eeb1811034d4c8b7381c54421ab04e73a6134d5cb7fe745d4fb');
});

test('keys sort at both levels regardless of input order', async () => {
  const doc = { image: { width: 256, type: 'image/png', sha256: 'ab'.repeat(32), height: 256 }, description: 'd', v: 1, name: 'N' };
  const json = canonicalMetadataJson(doc as MetadataDocument);
  assert.equal(json, `{"description":"d","image":{"height":256,"sha256":"${'ab'.repeat(32)}","type":"image/png","width":256},"name":"N","v":1}`);
  assert.equal(await metadataHash(doc as MetadataDocument), sha(json));
});

test('escapes quotes and backslashes only; Unicode and / stay literal', async () => {
  const doc = { ...base, name: 'a/b "q" \\ é 🚀', description: 'line  two ' };
  const json = canonicalMetadataJson(doc);
  assert.equal(json, '{"description":"line  two ","image":null,"name":"a/b \\"q\\" \\\\ é 🚀","v":1}');
  assert.equal(await metadataHash(doc), sha(json));
});

test('validateMetadata returns a plain copy and keeps whitespace', () => {
  const doc = { ...base, name: '  spaced  ', image: { ...img } };
  const out = validateMetadata(doc);
  assert.deepEqual(out, doc);
  assert.notEqual(out.image, doc.image);
  assert.deepEqual(validateMetadata({ ...base, image: { ...img, type: 'image/webp', width: 64, height: 64 } }).image?.width, 64);
  assert.equal(validateMetadata({ ...base, name: 'x'.repeat(48), description: '🚀'.repeat(280) }).description.length, 560);
});

test('rejects wrong key sets at both levels', () => {
  rejects(null, 'null');
  rejects([], 'array');
  rejects({ v: 1, name: 'a', description: '' }, 'missing image');
  rejects({ ...base, extra: 1 }, 'extra key');
  rejects(JSON.parse('{"v":1,"name":"a","description":"","image":null,"__proto__":1}'), 'proto key');
  rejects({ ...base, image: { sha256: img.sha256, type: img.type, width: 256 } }, 'image missing height');
  rejects({ ...base, image: { ...img, alt: '' } }, 'image extra key');
  rejects({ ...base, image: 'x' }, 'image string');
});

test('rejects bad versions, strings and lengths', () => {
  rejects({ ...base, v: 2 }, 'v2');
  rejects({ ...base, v: '1' }, 'v string');
  rejects({ ...base, v: 1n }, 'v bigint');
  rejects({ ...base, name: '' }, 'empty name');
  rejects({ ...base, name: 'x'.repeat(49) }, 'long name');
  rejects({ ...base, name: '🚀'.repeat(49) }, 'long name in code points');
  rejects({ ...base, description: 'x'.repeat(281) }, 'long description');
  rejects({ ...base, name: 1 }, 'number name');
  rejects({ ...base, name: 'é' }, 'not NFC');
  rejects({ ...base, name: 'a\nb' }, 'newline');
  rejects({ ...base, description: 'tab\t' }, 'tab');
  rejects({ ...base, name: 'a\u007f' }, 'DEL');
  rejects({ ...base, name: 'a\u0085' }, 'C1 control');
  rejects({ ...base, name: 'a\ud83d' }, 'lone high surrogate');
  rejects({ ...base, name: '\ude80a' }, 'lone low surrogate');
});

test('rejects bad images', () => {
  rejects({ ...base, image: { ...img, sha256: 'AB'.repeat(32) } }, 'uppercase hex');
  rejects({ ...base, image: { ...img, sha256: 'ab'.repeat(31) } }, 'short hex');
  rejects({ ...base, image: { ...img, type: 'image/jpeg' } }, 'jpeg');
  rejects({ ...base, image: { ...img, width: 256, height: 255 } }, 'not square');
  rejects({ ...base, image: { ...img, width: 63, height: 63 } }, 'too small');
  rejects({ ...base, image: { ...img, width: 513, height: 513 } }, 'too large');
  rejects({ ...base, image: { ...img, width: 64.5, height: 64.5 } }, 'fraction');
  rejects({ ...base, image: { ...img, width: '256', height: '256' } }, 'string dims');
});

test('canonicalMetadataJson and metadataHash validate first', async () => {
  assert.throws(() => canonicalMetadataJson({ ...base, name: '' }), MetadataValidationError);
  await assert.rejects(metadataHash({ ...base, name: '' }), MetadataValidationError);
});
