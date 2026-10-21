import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr, formatBits, rsRemainder, versionBits } from '../src/qr.ts';

test('Reed-Solomon matches the 1-M "HELLO WORLD" reference codewords', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(rsRemainder(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('format and version bits match the standard tables', () => {
  assert.equal(formatBits('M', 0).toString(2).padStart(15, '0'), '101010000010010');
  assert.equal(formatBits('L', 0).toString(2).padStart(15, '0'), '111011111000100');
  assert.equal(formatBits('L', 4).toString(2).padStart(15, '0'), '110011000101111');
  assert.equal(formatBits('H', 7).toString(2).padStart(15, '0'), '000100000111011');
  assert.equal(versionBits(7).toString(2).padStart(18, '0'), '000111110010010100');
});

function finderAt(m: boolean[][], ox: number, oy: number): boolean {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      if (m[oy + y][ox + x] !== (ring !== 2)) return false;
    }
  }
  return true;
}

test('addresses encode at level M with finders, timing and a dark module', () => {
  const q = encodeQr('8Ep5GwasrohgscRB7wSZ1ULiFisMxMg6uq53DhVdsuHx');
  assert.equal(q.version, 4);
  assert.equal(q.size, 33);
  assert.ok(finderAt(q.modules, 0, 0) && finderAt(q.modules, q.size - 7, 0) && finderAt(q.modules, 0, q.size - 7));
  for (let i = 8; i < q.size - 8; i++) {
    assert.equal(q.modules[6][i], i % 2 === 0);
    assert.equal(q.modules[i][6], i % 2 === 0);
  }
  assert.equal(q.modules[q.size - 8][8], true);
  const bits = formatBits('M', q.mask);
  for (let i = 0; i <= 5; i++) assert.equal(q.modules[i][8], ((bits >>> i) & 1) === 1);
});

test('version grows with payload and stops past version 10', () => {
  assert.equal(encodeQr('a'.repeat(14)).version, 1);
  assert.equal(encodeQr('a'.repeat(15)).version, 2);
  assert.equal(encodeQr('a'.repeat(213)).version, 10);
  assert.throws(() => encodeQr('a'.repeat(214)), RangeError);
});

test('encoding is deterministic', () => {
  assert.deepEqual(encodeQr('bunkercoin'), encodeQr('bunkercoin'));
});
