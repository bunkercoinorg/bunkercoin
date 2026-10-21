import test from 'node:test';
import assert from 'node:assert/strict';
import { nextDelay, settle, type Settled } from '../lib/entity-state.ts';

interface Tx {
  final: boolean;
}
const pollTx = (tx: Tx | null) => (tx === null ? 15_000 : tx.final ? null : 5000);

test('a failed refresh keeps cached data, flags the error and the last success', () => {
  const ready = settle<Tx>(null, { ok: true, data: { final: false } }, 1000);
  const failed = settle(ready, { ok: false, error: 'down' }, 2000);
  assert.equal(failed.status, 'ready');
  assert.deepEqual(failed.data, { final: false });
  assert.equal(failed.refreshError, 'down');
  assert.equal(failed.error, null);
  assert.equal(failed.lastSuccess, 1000);
  const recovered = settle(failed, { ok: true, data: { final: true } }, 3000);
  assert.equal(recovered.refreshError, null);
  assert.equal(recovered.lastSuccess, 3000);
});

test('a failed first load is an error, not a ready state', () => {
  const s = settle<Tx>(null, { ok: false, error: 'down' }, 1000);
  assert.deepEqual(s, { status: 'error', data: null, error: 'down', refreshError: null, lastSuccess: null });
});

test('a transient error after not-found keeps polling the pending tx', () => {
  const missing = settle<Tx>(null, { ok: true, data: null }, 1000);
  assert.equal(missing.status, 'not-found');
  assert.equal(nextDelay(missing, pollTx), 15_000);
  const failed = settle(missing, { ok: false, error: 'down' }, 2000);
  assert.equal(failed.status, 'error');
  assert.equal(failed.lastSuccess, 1000);
  assert.equal(nextDelay(failed, pollTx), 15_000);
});

test('errors keep polling non-terminal entities and stop at terminal ones', () => {
  const pending: Settled<Tx> = settle<Tx>(null, { ok: true, data: { final: false } }, 1);
  assert.equal(nextDelay(settle(pending, { ok: false, error: 'x' }, 2), pollTx), 5000);
  const final = settle<Tx>(null, { ok: true, data: { final: true } }, 1);
  assert.equal(nextDelay(settle(final, { ok: false, error: 'x' }, 2), pollTx), null);
  assert.equal(nextDelay(final), null);
});
