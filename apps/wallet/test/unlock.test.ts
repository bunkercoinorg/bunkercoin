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
