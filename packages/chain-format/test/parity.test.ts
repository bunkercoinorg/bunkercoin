import test from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import * as next from '../src/index.ts';
import * as walletJson from '../../../apps/wallet/src/lib/json.ts';
import * as walletFormat from '../../../apps/wallet/src/lib/format.ts';
import * as walletKeys from '../../../apps/wallet/src/lib/keys.ts';
import * as explorerJson from '../../../apps/explorer/lib/json.ts';
import * as explorerAmount from '../../../apps/explorer/lib/amount.ts';
import * as explorerCodec from '../../../apps/explorer/lib/codec.ts';

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const outcome = (f: () => unknown): { ok: true; value: unknown } | { ok: false; kind: string } => {
  try {
    return { ok: true, value: f() };
  } catch (e) {
    return { ok: false, kind: (e as Error).constructor.name };
  }
};

function randomBytes(r: () => number, n: number): Uint8Array {
  const out = new Uint8Array(n);
  const zeros = r() < 0.2 ? Math.floor(r() * 4) : 0;
  for (let k = zeros; k < n; k++) out[k] = Math.floor(r() * 256);
  return out;
}

function randomUnits(r: () => number): bigint {
  const pick = r();
  if (pick < 0.1) return 0n;
  if (pick < 0.2) return next.U64_MAX - BigInt(Math.floor(r() * 1000));
  let v = 0n;
  for (let k = Math.floor(r() * 5); k >= 0; k--) v = (v << 16n) | BigInt(Math.floor(r() * 65536));
  return r() < 0.1 ? -v : v;
}

const JSON_DOCS = [
  '{"value":18446744073709551615,"n":-5,"f":1.5,"e":1e3,"s":"a\\u00e9\\n"}',
  '[9007199254740991,9007199254740992,-9007199254740993,0,-0]',
  '{"__proto__":{"x":1},"a":1,"a":2}',
  '"\\ud800 lone"',
  '[1,]',
  '{"a" 1}',
  '01',
  '"a\nb"',
  '1 2',
  '',
];

test('parseJson(all) is the wallet parser', () => {
  for (const doc of JSON_DOCS) {
    assert.deepStrictEqual(outcome(() => next.parseJson(doc)), outcome(() => walletJson.parseJson(doc)), doc);
  }
});

test('parseJson(unsafe) is the explorer parser', () => {
  for (const doc of JSON_DOCS) {
    assert.deepStrictEqual(outcome(() => next.parseJson(doc, { bigints: 'unsafe' })), outcome(() => explorerJson.parseJson(doc)), doc);
  }
});

test('stringifyJson is the wallet serializer', () => {
  const docs = [{ a: 1n, b: [undefined, 'x', null], c: undefined, d: { e: -2.5 } }, [next.U64_MAX], 'é"', 0, true, null];
  for (const doc of docs) assert.equal(next.stringifyJson(doc), walletJson.stringifyJson(doc));
});

test('formatUnits(trim) equals both legacy formatters; grouping equals formatCount/formatInteger', () => {
  const r = rng(7);
  for (let n = 0; n < 3000; n++) {
    const u = randomUnits(r);
    const trimmed = next.formatUnits(u, 6, { trim: true });
    assert.equal(trimmed, walletFormat.formatUnits(u), String(u));
    assert.equal(trimmed, explorerAmount.formatBunker(u), String(u));
    assert.equal(next.formatUnits(u, 0), walletFormat.formatCount(u));
    assert.equal(next.formatInteger(u), explorerAmount.formatInteger(u));
    assert.equal(next.formatUnits(u, 0), explorerAmount.formatUnits(u, 0));
  }
});

test('parseUnits accepts a subset of the legacy parsers, with identical values', () => {
  const r = rng(8);
  const alphabet = ['0', '1', '5', '9', '.', ',', ' ', '-', 'e', '0', '0', '7'];
  const inputs = ['18446744073709.551615', '18446744073709.551616', '18446744073709551615', '18446744073709551616', '0.000001', '1.0000001'];
  for (let n = 0; n < 4000; n++) {
    inputs.push(Array.from({ length: 1 + Math.floor(r() * 22) }, () => alphabet[Math.floor(r() * alphabet.length)]).join(''));
  }
  for (const s of inputs) {
    const native = outcome(() => next.parseUnits(s, 6));
    const bunker = outcome(() => walletFormat.parseBunker(s));
    if (native.ok) assert.deepStrictEqual(native, bunker, s);
    else if (bunker.ok) assert.fail(`legacy parseBunker accepted ${JSON.stringify(s)} that parseUnits rejects`);
    const token = outcome(() => next.parseUnits(s, 0));
    const count = outcome(() => walletFormat.parseCount(s));
    if (token.ok) assert.deepStrictEqual(token, count, s);
    else if (count.ok) assert.match(s, /[, ]/, `legacy parseCount accepted ${JSON.stringify(s)}`);
  }
});

test('base58 matches bs58 and the explorer codec', () => {
  const r = rng(9);
  for (let n = 0; n < 2000; n++) {
    const bytes = randomBytes(r, Math.floor(r() * 40));
    const enc = next.bytesToBase58(bytes);
    assert.equal(enc, bs58.encode(bytes));
    assert.equal(enc, explorerCodec.base58Encode(bytes));
    if (bytes.length > 0) {
      assert.deepEqual(next.base58ToBytes(enc), bs58.decode(enc));
      assert.deepEqual(next.base58ToBytes(enc), explorerCodec.base58Decode(enc));
    }
  }
});

test('id normalization matches the explorer codec and the wallet address decoder', () => {
  const r = rng(10);
  const inputs = ['', ' ', '0OIl', 'deadbeef', 'DEADBEEF', '1'.repeat(32), 'ab'.repeat(31), 'AB'.repeat(32), '00000001', '18446744073709551616'];
  for (let n = 0; n < 1000; n++) {
    const bytes = randomBytes(r, r() < 0.7 ? 32 : Math.floor(r() * 40));
    inputs.push(r() < 0.5 ? bs58.encode(bytes) : next.bytesToHex(bytes), ` ${bs58.encode(bytes)}\n`);
  }
  for (const s of inputs) {
    assert.equal(next.normalizeHash(s), explorerCodec.normalizeHash(s), s);
    assert.equal(next.normalizeTokenId(s), explorerCodec.normalizeTokenId(s), s);
    assert.equal(next.normalizeSlot(s), explorerCodec.normalizeSlot(s), s);
    assert.equal(next.toBase58(s), explorerCodec.toBase58(s), s);
    assert.equal(next.isAddress(s), walletKeys.isValidAddress(s), s);
    assert.equal(next.isTokenId(s), walletKeys.isTokenId(s), s);
    if (next.isAddress(s)) assert.deepEqual(next.decodeId(s), walletKeys.decodeAddress(s), s);
  }
});
