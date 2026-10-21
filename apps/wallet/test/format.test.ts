import test from 'node:test';
import assert from 'node:assert/strict';
import { elapsedLabel, formatCount, formatUnits, parseBunker, parseCount, shortAddress, U64_MAX } from '../src/lib/format.ts';

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
  assert.throws(() => parseBunker('18446744073709.551616'), /that is more than a u64 can hold\./);
  assert.throws(() => parseBunker('0'), /Enter an amount above 0\./);
  assert.throws(() => parseBunker('0.0000001'), /BUNKER allows up to 6 decimals\./);
  assert.throws(() => parseBunker('1e3'), /Enter an amount above 0\./);
  assert.throws(() => parseBunker('-1'), /Enter an amount above 0\./);
});

test('parseCount accepts whole numbers up to u64 without rounding', () => {
  assert.equal(parseCount('9007199254740993'), 9007199254740993n);
  assert.equal(parseCount('1,000 000'), 1_000_000n);
  assert.equal(formatCount(9007199254740993n), '9,007,199,254,740,993');
  assert.throws(() => parseCount('18446744073709551616'), /more than a u64 can hold/);
  assert.throws(() => parseCount('1.5'), /Tokens use whole units\./);
  assert.throws(() => parseCount('0'), /Enter an amount above 0\./);
  assert.throws(() => parseCount('1e3'), /Enter an amount above 0\./);
});

test('shortAddress follows the spec truncation unless a length is asked for', () => {
  assert.equal(shortAddress('8Ep5abcdefghijklmnopqrstuvwxyzsuHx'), '8Ep5…suHx');
  assert.equal(shortAddress('7ffcc7a4a3b62bed4719eb50dbf47bf9da7d8758e1679b2b13782bb0e99a52bf'), '7ffcc7…52bf');
  assert.equal(shortAddress('abcdefghijklmnopqrstuvwxyz', 6), 'abcdef…uvwxyz');
  assert.equal(shortAddress('short'), 'short');
  assert.equal(elapsedLabel(Date.now() - 61_000), '1m 1s');
});
