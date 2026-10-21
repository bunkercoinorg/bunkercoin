import test from 'node:test';
import assert from 'node:assert/strict';
import { settleUnlock, UnlockGate } from '../src/lib/unlock.ts';
import { createMnemonic, keypairFromMnemonic, type Keypair } from '../src/lib/keys.ts';

test('an unlock that finishes after erase or unmount is discarded and its key zeroed', () => {
  const gate = new UnlockGate();
  const current = gate.begin();
  gate.invalidate();
  const keypair = keypairFromMnemonic(createMnemonic());
  const accepted: Keypair[] = [];
  assert.equal(settleUnlock(current(), keypair, (k) => accepted.push(k)), false);
  assert.equal(accepted.length, 0, 'no signer or session may be created');
  assert.ok(keypair.privateKey.every((b) => b === 0), 'the stale key is wiped');
});

test('a current unlock hands its key on untouched', () => {
  const gate = new UnlockGate();
  const stale = gate.begin();
  gate.invalidate();
  const current = gate.begin();
  assert.equal(stale(), false);
  const keypair = keypairFromMnemonic(createMnemonic());
  const before = Uint8Array.from(keypair.privateKey);
  let got: Keypair | null = null;
  assert.equal(settleUnlock(current(), keypair, (k) => (got = k)), true);
  assert.equal(got, keypair);
  assert.deepEqual(keypair.privateKey, before);
});

test('unlock and setup failures map to distinct copy', async () => {
  const { unlockErrorCopy, setupErrorCopy } = await import('../src/lib/unlock.ts');
  const { KeystoreError } = await import('../src/lib/keystore.ts');
  assert.equal(unlockErrorCopy(new Error('Incorrect password')), 'Wrong password.');
  assert.equal(unlockErrorCopy(new KeystoreError('corrupt', 'x')), 'Saved wallet is damaged. Import with your 24 words.');
  assert.equal(unlockErrorCopy(new Error('Invalid recovery phrase')), 'Saved wallet is damaged. Import with your 24 words.');
  assert.equal(unlockErrorCopy(new KeystoreError('unavailable', 'x')), 'This browser blocked storage.');
  assert.equal(unlockErrorCopy(new RangeError('WebAssembly.Memory.grow(): Maximum memory size exceeded')), 'Out of memory. Close other tabs and retry.');
  assert.equal(unlockErrorCopy(new Error('The wallet on this device changed meanwhile.')), 'The wallet on this device changed meanwhile.');
  assert.equal(setupErrorCopy(new DOMException('full', 'QuotaExceededError')), 'Storage is full or blocked. Nothing was saved.');
  assert.equal(setupErrorCopy(new Error('A wallet record already exists on this device')), 'A wallet record already exists on this device');
});
