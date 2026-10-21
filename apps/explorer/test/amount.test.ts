import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBunker, formatInteger, formatUnits } from '../lib/amount.ts';
import { parseJson } from '../lib/json.ts';

test('formatBunker divides base units by 10^6 without floats', () => {
  assert.equal(formatBunker(0n), '0');
  assert.equal(formatBunker(1n), '0.000001');
  assert.equal(formatBunker(1_000_000n), '1');
  assert.equal(formatBunker(1_234_567_890n), '1,234.56789');
});

test('u64 max formats exactly', () => {
  assert.equal(formatBunker(18446744073709551615n), '18,446,744,073,709.551615');
  assert.equal(formatInteger(18446744073709551615n), '18,446,744,073,709,551,615');
});

test('formatUnits handles zero decimals and negatives', () => {
  assert.equal(formatUnits(1234n, 0), '1,234');
  assert.equal(formatUnits(-1_500_000n, 6), '-1.5');
});

test('amounts above 2^53 survive JSON parsing', () => {
  const v = parseJson('{"native_balance":9007199254740993,"nonce":5}') as Record<string, unknown>;
  assert.equal(v.native_balance, 9007199254740993n);
  assert.equal(v.nonce, 5);
});

test('parseJson matches JSON.parse on ordinary documents', () => {
  const doc = '{"a":[1,-2.5,3e2,true,false,null],"s":"x\\n\\u00e9\\"","o":{}}';
  assert.deepEqual(parseJson(doc), JSON.parse(doc));
});

test('parseJson keeps the last duplicate key like JSON.parse', () => {
  assert.deepEqual(parseJson('{"type":"a","type":"b"}'), { type: 'b' });
});

test('parseJson does not let __proto__ rewrite the prototype', () => {
  const v = parseJson('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(v), Object.prototype);
  assert.deepEqual(Object.keys(v), ['__proto__']);
});

test('parseJson rejects malformed input', () => {
  for (const bad of ['', '{', '[1,]', '01', '{"a" 1}', '"\\x"', '1 2']) {
    assert.throws(() => parseJson(bad), SyntaxError, bad);
  }
});
