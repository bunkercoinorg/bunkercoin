import test from 'node:test';
import assert from 'node:assert/strict';
import { appendTxs, emptyTxs, txAmount, txExecution, txType } from '../lib/txs.ts';
import type { TransactionDetails, TransactionPage } from '../lib/types.ts';

const tx = (hash: string, over: Partial<TransactionDetails> = {}): TransactionDetails => ({
  hash,
  sender: 'ab'.repeat(32),
  nonce: 1n,
  fee: 100n,
  status: { location: 'finalized' },
  ...over,
});

const page = (hashes: string[], offset: number, total: number, limit = 3): TransactionPage => ({
  transactions: hashes.map((h) => tx(h)),
  total,
  offset,
  limit,
});

test('overlapping pages de-duplicate without rewinding the offset', () => {
  let list = appendTxs(emptyTxs, page(['a', 'b', 'c'], 0, 3), 3);
  assert.equal(list.done, false);
  list = appendTxs(list, page(['c', 'd', 'e'], 3, 6), 3);
  assert.deepEqual(list.txs.map((t) => t.hash), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(list.consumed, 6);
  assert.equal(list.done, false);
});

test('a short page or a total below offset + limit ends paging', () => {
  assert.equal(appendTxs(emptyTxs, page(['a', 'b'], 0, 2), 3).done, true);
  assert.equal(appendTxs(emptyTxs, page([], 0, 0), 3).done, true);
  assert.equal(appendTxs(emptyTxs, { ...page(['a', 'b', 'c'], 0, 3), total: 2 }, 3).done, true);
});

test('rows name the type, amount and execution, with a dash for the unknown', () => {
  const ticker = (id: string) => (id === '01000000' ? 'RADIO' : `token ${id}`);
  assert.equal(txAmount(tx('a', { body: { type: 'Transfer', amount: 1_500_000n } }), ticker), '1.500000 BUNKER');
  assert.equal(txAmount(tx('a', { body: { type: 'TokenTransfer', amount: 12n, token_id: '01000000' } }), ticker), '12 RADIO');
  assert.equal(txAmount(tx('a', { body: { type: 'Mint', ticker: 'RADIO', max_supply: 1_000_000n } }), ticker), 'create RADIO · 1,000,000');
  assert.equal(txAmount(tx('a', { body: { type: 'Stake' } }), ticker), '–');
  assert.equal(txAmount(tx('a'), ticker), '–');
  assert.equal(txType(tx('a', { body: { type: 'Mint' } })), 'create token');
  assert.equal(txType(tx('a', { body: { type: 'Stake' } })), 'Stake');
  assert.equal(txType(tx('a')), '–');
  assert.equal(txExecution(tx('a', { status: { location: 'finalized', success: false } })), 'failed');
  assert.equal(txExecution(tx('a', { status: { location: 'confirmed' } })), '–');
});
