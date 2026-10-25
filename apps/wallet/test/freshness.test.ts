import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionStatus, initialFreshness, networkLabel } from '../src/lib/freshness.ts';

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

test('the header tag names the connection state in words, not only in tone', () => {
  assert.deepEqual(networkLabel('connecting'), { tone: 'neutral', text: 'connecting' });
  assert.deepEqual(networkLabel('live'), { tone: 'live', text: 'testnet · live' });
  assert.deepEqual(networkLabel('partial'), { tone: 'unknown', text: 'testnet · partial' });
  assert.deepEqual(networkLabel('stale'), { tone: 'unknown', text: 'offline' });
  assert.deepEqual(networkLabel('offline'), { tone: 'unknown', text: 'offline' });
  const texts = (['connecting', 'live', 'partial', 'offline'] as const).map((s) => networkLabel(s).text);
  assert.equal(new Set(texts).size, texts.length);
});
