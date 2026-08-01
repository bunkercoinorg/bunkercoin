import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptMnemonic, decryptMnemonic, KDF_DEFAULTS } from '../src/lib/keystore.js';

// Fast parameters for functional tests — production strength is timed separately.
const FAST = { iterations: 1, memorySizeKiB: 1024, parallelism: 1 };

const PHRASE =
  'flash jazz better tiger arena mimic tumble ghost lens vault runway castle ' +
  'pilot lemon garden fossil pond insect trophy velvet spice ozone crystal rebel';

test('encrypt/decrypt round-trips the mnemonic', async () => {
  const record = await encryptMnemonic(PHRASE, 'correct horse battery staple', FAST);
  assert.equal(await decryptMnemonic(record, 'correct horse battery staple'), PHRASE);
});

test('wrong password is rejected, not garbage-decrypted', async () => {
  const record = await encryptMnemonic(PHRASE, 'right-password', FAST);
  await assert.rejects(decryptMnemonic(record, 'wrong-password'), /Incorrect password/);
});

test('ciphertext tampering is detected', async () => {
  const record = await encryptMnemonic(PHRASE, 'pw', FAST);
  const bytes = Uint8Array.from(atob(record.ciphertext), (c) => c.charCodeAt(0));
  bytes[0] ^= 0xff;
  const tampered = { ...record, ciphertext: btoa(String.fromCharCode(...bytes)) };
  await assert.rejects(decryptMnemonic(tampered, 'pw'), /Incorrect password/);
});

test('record never contains the phrase or password in plaintext', async () => {
  const record = await encryptMnemonic(PHRASE, 'hunter2-hunter2', FAST);
  const serialized = JSON.stringify(record);
  assert.ok(!serialized.includes('flash'), 'first mnemonic word leaked');
  assert.ok(!serialized.includes('hunter2'), 'password leaked');
});

test('two encryptions of the same phrase share nothing (fresh salt/iv)', async () => {
  const a = await encryptMnemonic(PHRASE, 'pw', FAST);
  const b = await encryptMnemonic(PHRASE, 'pw', FAST);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test('decryption honours the parameters stored in the record', async () => {
  const custom = { iterations: 2, memorySizeKiB: 2048, parallelism: 1 };
  const record = await encryptMnemonic(PHRASE, 'pw', custom);
  assert.equal(record.kdf.iterations, 2);
  assert.equal(await decryptMnemonic(record, 'pw'), PHRASE);
});

test('production KDF parameters cost seconds, not milliseconds', async () => {
  const start = performance.now();
  await encryptMnemonic(PHRASE, 'timing-check', KDF_DEFAULTS);
  const elapsed = performance.now() - start;
  console.log(`    argon2id at production strength: ${Math.round(elapsed)}ms`);
  assert.ok(elapsed > 1500, `KDF too fast to be a deterrent: ${Math.round(elapsed)}ms`);
});
