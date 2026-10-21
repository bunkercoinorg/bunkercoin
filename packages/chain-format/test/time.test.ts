import test from 'node:test';
import assert from 'node:assert/strict';
import { bytesToBase58, formatTokenId, isAddress, isTokenId } from '../src/codec.ts';
import { normalizeTimestampMs, relativeAge, shortId, utcClock } from '../src/time.ts';

test('normalizeTimestampMs reads seconds and ms once', () => {
  assert.equal(normalizeTimestampMs(1_760_000_000), 1_760_000_000_000);
  assert.equal(normalizeTimestampMs(1_760_000_000_123), 1_760_000_000_123);
  assert.equal(normalizeTimestampMs(0), null);
  assert.equal(normalizeTimestampMs(-5), null);
  assert.equal(normalizeTimestampMs(Number.NaN), null);
});

test('relativeAge uses the spec steps', () => {
  const now = 1_000_000_000;
  assert.equal(relativeAge(now - 4_000, now), '4s');
  assert.equal(relativeAge(now - 760_000, now), '12m 40s');
  assert.equal(relativeAge(now - 3 * 3_600_000 - 59_000, now), '3h');
  assert.equal(relativeAge(now - 2 * 86_400_000, now), '2d');
  assert.equal(relativeAge(now + 5_000, now), '0s');
});

test('utcClock prints UTC wall time', () => {
  assert.equal(utcClock(Date.UTC(2026, 9, 21, 21, 4, 17)), '21:04:17 UTC');
  assert.equal(utcClock(Date.UTC(2026, 0, 1, 1, 2, 3)), '01:02:03 UTC');
});

test('shortId keeps 4…4 for base58 and 6…4 for hex', () => {
  assert.equal(shortId('8Ep5GwasrohgscRB7wSZ1ULiFisMxMg6uq53DhVdsuHx'), '8Ep5…suHx');
  assert.equal(shortId('7ffcc7' + '0'.repeat(54) + '52bf'), '7ffcc7…52bf');
  assert.equal(shortId('01000000'), '01000000');
});

test('token ids and addresses validate by byte length', () => {
  assert.equal(isTokenId('01000000'), true);
  assert.equal(isTokenId('0100000A'), false);
  assert.equal(formatTokenId(new Uint8Array([1, 0, 0, 0xab])), '010000ab');
  assert.throws(() => formatTokenId(new Uint8Array(5)), RangeError);
  assert.equal(isAddress('8Ep5GwasrohgscRB7wSZ1ULiFisMxMg6uq53DhVdsuHx'), true);
  assert.equal(isAddress('ab'.repeat(32)), true);
  assert.equal(isAddress(bytesToBase58(new Uint8Array(31).fill(7))), false);
  assert.equal(isAddress('0OIl'), false);
});
