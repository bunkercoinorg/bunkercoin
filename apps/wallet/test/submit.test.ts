import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileNonce, withAccountLock } from '../src/lib/submit.ts';
import { Signer, WalletLockedError } from '../src/lib/signer.ts';
import { addEntry, clearAllPending, loadPending, mutatePending, patchEntry, type PendingTx } from '../src/lib/pending.ts';
import { keypairFromMnemonic, createMnemonic } from '../src/lib/keys.ts';

test('nonce advances past live outstanding transactions only', () => {
  assert.equal(reconcileNonce(5n, []), 5n);
  assert.equal(reconcileNonce(5n, [{ nonce: 5n, live: true }, { nonce: 6n, live: true }]), 7n);
  assert.equal(reconcileNonce(5n, [{ nonce: 5n, live: false }, { nonce: 6n, live: true }]), 5n, 'a dropped tx frees its nonce');
  assert.equal(reconcileNonce(5n, [{ nonce: 4n, live: true }]), 5n, 'executed nonces are ignored');
  assert.equal(reconcileNonce(5n, [{ nonce: 7n, live: true }]), 5n, 'gaps are filled first');
});

test('submissions on one account never overlap', async () => {
  const order: string[] = [];
  const job = (name: string, ms: number) =>
    withAccountLock('acct', async () => {
      order.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${name}:end`);
      if (name === 'b') throw new Error('boom');
    });
  const results = await Promise.allSettled([job('a', 20), job('b', 1), job('c', 1)]);
  assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  assert.equal(results[1].status, 'rejected', 'a failure is reported to its caller only');
  assert.equal(results[2].status, 'fulfilled');
});

test('a revoked signer zeroes its key and refuses to sign', () => {
  const keypair = keypairFromMnemonic(createMnemonic());
  const key = keypair.privateKey;
  const signer = new Signer(keypair);
  assert.equal(signer.use((pk) => pk.length), 32);
  signer.revoke();
  assert.ok(key.every((b) => b === 0), 'key buffer must be wiped');
  assert.equal(signer.active, false);
  assert.throws(() => signer.assertActive(), WalletLockedError);
  assert.throws(() => signer.use(() => 1), WalletLockedError);
});

function fakeStorage() {
  const store = new Map<string, string>();
  const fake = {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  return store;
}

const entry = (over: Partial<PendingTx> = {}): PendingTx => ({
  txId: 'tx1',
  kind: 'send',
  amount: 9007199254740993n,
  at: 1,
  nonce: 3n,
  state: 'pending',
  ...over,
});

test('pending entries are scoped by chain and address and keep bigint amounts', () => {
  const store = fakeStorage();
  assert.ok(mutatePending('rpc-a', 'alice', addEntry(entry())));
  assert.deepEqual(loadPending('rpc-a', 'alice'), [entry()]);
  assert.deepEqual(loadPending('rpc-a', 'bob'), [], 'another wallet must not inherit activity');
  assert.deepEqual(loadPending('rpc-b', 'alice'), [], 'another chain must not inherit activity');
  mutatePending('rpc-a', 'alice', patchEntry('tx1', { state: 'unconfirmed' }));
  assert.equal(loadPending('rpc-a', 'alice')[0].state, 'unconfirmed');
  store.set('bunkercoin.pending.v1', '[]');
  clearAllPending();
  assert.equal(store.size, 0, 'erase clears every wallet, chain and legacy entry');
});

test('malformed pending entries are dropped, not trusted', () => {
  const store = fakeStorage();
  mutatePending('c', 'a', addEntry(entry()));
  const key = [...store.keys()][0];
  const list = JSON.parse(store.get(key)!);
  list.push({ ...list[0], txId: 'tx2', amount: 1.5 }, { ...list[0], txId: 'tx3', state: 'done' });
  store.set(key, JSON.stringify(list));
  assert.deepEqual(
    loadPending('c', 'a').map((p) => p.txId),
    ['tx1'],
  );
});
