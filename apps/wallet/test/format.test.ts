import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCount, formatUnits, parseBunker, parseCount, U64_MAX } from '../src/lib/format.ts';
import { parseJson, stringifyJson } from '../src/lib/json.ts';

test('parseJson keeps u64 integers exact', () => {
  const parsed = parseJson('{"value":18446744073709551615,"slot":9007199254740993,"neg":-5}') as Record<string, unknown>;
  assert.equal(parsed.value, 18446744073709551615n);
  assert.equal(parsed.slot, 9007199254740993n);
  assert.equal(parsed.neg, -5n);
});

test('parseJson handles the full grammar', () => {
  assert.deepEqual(parseJson(' [1.5, 2e3, "a\\"b\\u00e9\\n", true, false, null, {}, []] '), [
    1.5,
    2000,
    'a"bé\n',
    true,
    false,
    null,
    {},
    [],
  ]);
  const obj = parseJson('{"__proto__": {"polluted": 1}}') as Record<string, unknown>;
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.ok(Object.hasOwn(obj, '__proto__'));
});

test('parseJson rejects malformed input', () => {
  for (const bad of ['', '{', '[1,]', '{"a":1,}', '01', '1 2', '"\\x"', 'nul', '{"a" 1}', '"a\nb"']) {
    assert.throws(() => parseJson(bad), SyntaxError, bad);
  }
});

test('stringifyJson writes bigints as bare integers and round-trips', () => {
  const tx = { nonce: 9007199254740993n, fee: 100n, body: { Transfer: { to: 'x', amount: U64_MAX } }, skip: undefined };
  const text = stringifyJson(tx);
  assert.equal(text, '{"nonce":9007199254740993,"fee":100,"body":{"Transfer":{"to":"x","amount":18446744073709551615}}}');
  assert.deepEqual(parseJson(text), { nonce: 9007199254740993n, fee: 100n, body: { Transfer: { to: 'x', amount: U64_MAX } } });
});

test('formatUnits is exact for large balances', () => {
  assert.equal(formatUnits(0n), '0');
  assert.equal(formatUnits(1n), '0.000001');
  assert.equal(formatUnits(1_500_000n), '1.5');
  assert.equal(formatUnits(1_234_567_890_123n), '1,234,567.890123');
  assert.equal(formatUnits(U64_MAX), '18,446,744,073,709.551615');
});

test('parseBunker returns exact bigint units', () => {
  assert.equal(parseBunker('0.5'), 500_000n);
  assert.equal(parseBunker(' 1 '), 1_000_000n);
  assert.equal(parseBunker('9007199254.740993'), 9007199254740993n);
  assert.equal(parseBunker('18446744073709.551615'), U64_MAX);
  assert.throws(() => parseBunker('18446744073709.551616'), /too large/);
  assert.throws(() => parseBunker('0'), /positive/);
  assert.throws(() => parseBunker('0.0000001'), /Smallest unit/);
  assert.throws(() => parseBunker('1e3'), /positive/);
  assert.throws(() => parseBunker('-1'), /positive/);
});

test('parseCount accepts whole numbers up to u64 without rounding', () => {
  assert.equal(parseCount('9007199254740993'), 9007199254740993n);
  assert.equal(parseCount('1,000 000'), 1_000_000n);
  assert.equal(formatCount(9007199254740993n), '9,007,199,254,740,993');
  assert.throws(() => parseCount('18446744073709551616'), /too large/);
  assert.throws(() => parseCount('1.5'), /whole/);
  assert.throws(() => parseCount('0'), /whole/);
  assert.throws(() => parseCount('1e3'), /whole/);
});
