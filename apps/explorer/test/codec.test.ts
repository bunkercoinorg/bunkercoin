import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base58Decode,
  base58Encode,
  hexDecode,
  hexEncode,
  normalizeHash,
  normalizeSlot,
  normalizeTokenId,
  toBase58,
} from '../lib/codec.ts';

const bytes = (...b: number[]) => new Uint8Array(b);

test('base58 round-trips known vectors', () => {
  assert.equal(base58Encode(new TextEncoder().encode('hello world')), 'StV1DL6CwTryKyV');
  assert.deepEqual(base58Decode('StV1DL6CwTryKyV'), new TextEncoder().encode('hello world'));
});

test('all-zero inputs map one byte to one leading 1', () => {
  assert.equal(base58Encode(bytes(0)), '1');
  assert.equal(base58Encode(bytes(0, 0, 0)), '111');
  assert.equal(base58Encode(new Uint8Array(32)), '1'.repeat(32));
  assert.deepEqual(base58Decode('1'), bytes(0));
  assert.deepEqual(base58Decode('1'.repeat(32)), new Uint8Array(32));
  assert.equal(base58Encode(new Uint8Array(0)), '');
});

test('leading zeros survive alongside value bytes', () => {
  const b = bytes(0, 0, 1, 2, 255);
  assert.deepEqual(base58Decode(base58Encode(b)), b);
});

test('base58 rejects characters outside the alphabet', () => {
  assert.equal(base58Decode('0OIl'), null);
  assert.equal(base58Decode(''), null);
});

test('hex codec round-trips and rejects odd or non-hex input', () => {
  assert.equal(hexEncode(bytes(0, 171, 255)), '00abff');
  assert.deepEqual(hexDecode('00ABff'), bytes(0, 171, 255));
  assert.equal(hexDecode('abc'), null);
  assert.equal(hexDecode('zz'), null);
});

test('normalizeHash accepts 64-char hex and 32-byte base58 only', () => {
  const key = new Uint8Array(32).fill(7);
  const hex = hexEncode(key);
  assert.equal(normalizeHash(hex.toUpperCase()), hex);
  assert.equal(normalizeHash(base58Encode(key)), hex);
  assert.equal(normalizeHash('1'.repeat(32)), '00'.repeat(32));
  assert.equal(normalizeHash(base58Encode(new Uint8Array(31).fill(7))), null);
  assert.equal(normalizeHash('ab'.repeat(31)), null);
});

test('hex-looking base58 that is not exactly 64 chars decodes as base58', () => {
  assert.equal(normalizeHash('1'.repeat(32)), '00'.repeat(32));
  const key = new Uint8Array(32);
  key[31] = 1;
  assert.equal(normalizeHash(base58Encode(key)), hexEncode(key));
  assert.equal(normalizeHash('deadbeef'), null);
});

test('token ids are exactly 4 bytes of hex', () => {
  assert.equal(normalizeTokenId('DEADBEEF'), 'deadbeef');
  assert.equal(normalizeTokenId('deadbee'), null);
  assert.equal(normalizeTokenId('deadbeef00'), null);
});

test('slots are canonical u64 decimals', () => {
  assert.equal(normalizeSlot('00000001'), '1');
  assert.equal(normalizeSlot('18446744073709551615'), '18446744073709551615');
  assert.equal(normalizeSlot('18446744073709551616'), null);
  assert.equal(normalizeSlot('-1'), null);
  assert.equal(normalizeSlot('1e3'), null);
});

test('toBase58 only converts 32-byte keys', () => {
  const key = new Uint8Array(32).fill(1);
  assert.equal(toBase58(hexEncode(key)), base58Encode(key));
  assert.equal(toBase58('unknown'), 'unknown');
  assert.equal(toBase58('deadbeef'), 'deadbeef');
});
