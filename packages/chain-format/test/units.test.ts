import test from 'node:test';
import assert from 'node:assert/strict';
import { AmountError, formatInteger, formatUnits, parseUnits, U64_MAX } from '../src/units.ts';
import { parseJson, stringifyJson } from '../src/json.ts';

const rejects = (text: string, scale: 0 | 6, copy: string) =>
  assert.throws(() => parseUnits(text, scale), (e: unknown) => e instanceof AmountError && e.message === copy, `${text} @${scale}`);

test('parseJson keeps u64 integers exact', () => {
  const parsed = parseJson('{"value":18446744073709551615,"slot":9007199254740993,"neg":-5}') as Record<string, unknown>;
  assert.equal(parsed.value, 18446744073709551615n);
  assert.equal(parsed.slot, 9007199254740993n);
  assert.equal(parsed.neg, -5n);
  const unsafe = parseJson('{"native_balance":9007199254740993,"nonce":5}', { bigints: 'unsafe' }) as Record<string, unknown>;
  assert.equal(unsafe.native_balance, 9007199254740993n);
  assert.equal(unsafe.nonce, 5);
});

test('parseJson handles the full grammar and refuses prototype pollution', () => {
  assert.deepEqual(parseJson(' [1.5, 2e3, "a\\"b\\u00e9\\n", true, false, null, {}, []] '), [1.5, 2000, 'a"bé\n', true, false, null, {}, []]);
  const obj = parseJson('{"__proto__": {"polluted": 1}}') as Record<string, unknown>;
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.ok(Object.hasOwn(obj, '__proto__'));
  assert.equal(Object.getPrototypeOf(obj), Object.prototype);
  assert.deepEqual(parseJson('{"type":"a","type":"b"}', { bigints: 'unsafe' }), { type: 'b' });
});

test('parseJson bounds nesting depth', () => {
  assert.doesNotThrow(() => parseJson('['.repeat(65) + ']'.repeat(65)));
  assert.throws(() => parseJson('['.repeat(66) + ']'.repeat(66)), SyntaxError);
  assert.doesNotThrow(() => parseJson('['.repeat(300) + ']'.repeat(300), { maxDepth: 512 }));
});

test('stringifyJson writes bigints as bare integers and round-trips', () => {
  const tx = { nonce: 9007199254740993n, fee: 100n, body: { Transfer: { to: 'x', amount: U64_MAX } }, skip: undefined };
  const text = stringifyJson(tx);
  assert.equal(text, '{"nonce":9007199254740993,"fee":100,"body":{"Transfer":{"to":"x","amount":18446744073709551615}}}');
  assert.deepEqual(parseJson(text), { nonce: 9007199254740993n, fee: 100n, body: { Transfer: { to: 'x', amount: U64_MAX } } });
  assert.throws(() => stringifyJson(Number.NaN), TypeError);
});

test('formatUnits shows every decimal by default, groups, and never uses floats', () => {
  assert.equal(formatUnits(0n, 6), '0.000000');
  assert.equal(formatUnits(1n, 6), '0.000001');
  assert.equal(formatUnits(1_248_500_000n, 6), '1,248.500000');
  assert.equal(formatUnits(U64_MAX, 6), '18,446,744,073,709.551615');
  assert.equal(formatUnits(U64_MAX, 6, { group: false }), '18446744073709.551615');
  assert.equal(formatUnits(-12_500_100n, 6), '-12.500100');
  assert.equal(formatUnits(1234n, 0), '1,234');
  assert.equal(formatInteger(U64_MAX), '18,446,744,073,709,551,615');
});

test('formatUnits with trim matches the legacy display', () => {
  assert.equal(formatUnits(0n, 6, { trim: true }), '0');
  assert.equal(formatUnits(1_500_000n, 6, { trim: true }), '1.5');
  assert.equal(formatUnits(1_234_567_890n, 6, { trim: true }), '1,234.56789');
  assert.equal(formatUnits(-1_500_000n, 6, { trim: true }), '-1.5');
});

test('parseUnits returns exact native units', () => {
  assert.equal(parseUnits('0.5', 6), 500_000n);
  assert.equal(parseUnits(' 1 ', 6), 1_000_000n);
  assert.equal(parseUnits('9007199254.740993', 6), 9007199254740993n);
  assert.equal(parseUnits('18446744073709.551615', 6), U64_MAX);
  assert.equal(parseUnits('0.000001', 6), 1n);
});

test('parseUnits returns exact token units', () => {
  assert.equal(parseUnits('9007199254740993', 0), 9007199254740993n);
  assert.equal(parseUnits('18446744073709551615', 0), U64_MAX);
});

test('parseUnits rejects with the spec copy', () => {
  for (const bad of ['', ' ', '0', '0.000000', '-1', '1e3', '.5', '1.', 'abc', '1,000', '1 000', '+1', '0x10']) {
    rejects(bad, 6, 'Enter an amount above 0.');
  }
  rejects('0.0000001', 6, 'BUNKER allows up to 6 decimals.');
  rejects('1.1234567', 6, 'BUNKER allows up to 6 decimals.');
  rejects('1.5', 0, 'Tokens use whole units.');
  rejects('1.', 0, 'Tokens use whole units.');
  rejects('0', 0, 'Enter an amount above 0.');
  rejects('1,000 000', 0, 'Enter an amount above 0.');
  rejects('18446744073709.551616', 6, 'that is more than a u64 can hold.');
  rejects('18446744073709551616', 0, 'that is more than a u64 can hold.');
  assert.equal(new AmountError('range').code, 'range');
});
