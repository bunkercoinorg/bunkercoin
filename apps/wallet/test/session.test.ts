import test from 'node:test';
import assert from 'node:assert/strict';
import { autoLockMs, loadAutoLockMinutes, saveAutoLockMinutes, type AutoLockMinutes } from '../src/lib/session.ts';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

test('auto-lock defaults to 15 min and persists only the offered options', () => {
  store.clear();
  assert.equal(loadAutoLockMinutes(), 15);
  for (const m of [1, 5, 15, 60] as const) {
    saveAutoLockMinutes(m);
    assert.equal(loadAutoLockMinutes(), m);
    assert.equal(autoLockMs(), m * 60_000);
  }
  assert.throws(() => saveAutoLockMinutes(2 as AutoLockMinutes));
  store.set('bunkercoin.autolock.v1', '30');
  assert.equal(loadAutoLockMinutes(), 15);
  store.set('bunkercoin.autolock.v1', 'junk');
  assert.equal(loadAutoLockMinutes(), 15);
  assert.equal(autoLockMs(1), 60_000);
});
