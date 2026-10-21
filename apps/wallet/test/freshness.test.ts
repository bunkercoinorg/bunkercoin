import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionStatus, initialFreshness } from '../src/lib/freshness.ts';

test('a failing resource is reported even while the balance is live', () => {
  const f = initialFreshness();
  assert.equal(connectionStatus(f).status, 'connecting');
  f.balance = { okAt: 1, error: null };
  assert.deepEqual(connectionStatus(f), { status: 'live', failing: [] });
  f.history = { okAt: null, error: 'getTransactions: node unreachable' };
  f.tokens = { okAt: 1, error: 'timeout' };
  assert.deepEqual(connectionStatus(f), { status: 'partial', failing: ['tokens', 'history'] });
  f.balance = { okAt: 1, error: 'timeout' };
  assert.equal(connectionStatus(f).status, 'stale');
  f.balance = { okAt: null, error: 'timeout' };
  assert.equal(connectionStatus(f).status, 'offline');
});
