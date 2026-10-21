import test from 'node:test';
import assert from 'node:assert/strict';
import { addEntry, loadPending, mutatePending, pendingKey, type PendingTx } from '../src/lib/pending.ts';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

test('fees and metadata updates persist exactly; a malformed fee drops the entry', async () => {
  store.clear();
  const entry: PendingTx = { txId: 't1', kind: 'metadata', amount: 0n, at: 1, nonce: 4n, state: 'pending', fee: 18446744073709551615n };
  assert.ok(await mutatePending('c', 'a', addEntry(entry)));
  assert.match(store.get(pendingKey('c', 'a'))!, /"fee":"18446744073709551615"/);
  assert.deepEqual(loadPending('c', 'a'), [entry]);
  const legacy = { txId: 't2', kind: 'send', amount: '5', at: 2, nonce: '1', state: 'pending' };
  store.set(pendingKey('c', 'a'), JSON.stringify([legacy, { ...legacy, txId: 't3', fee: 1.5 }]));
  assert.deepEqual(loadPending('c', 'a'), [{ txId: 't2', kind: 'send', amount: 5n, at: 2, nonce: 1n, state: 'pending' }]);
});
