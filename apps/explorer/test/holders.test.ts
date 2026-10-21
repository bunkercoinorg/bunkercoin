import test from 'node:test';
import assert from 'node:assert/strict';
import { appendHolders, emptyHolders } from '../lib/holders.ts';
import type { HolderPage } from '../lib/types.ts';

const page = (keys: string[], total: number): HolderPage => ({
  holders: keys.map((pubkey) => ({ pubkey, balance: 1n })),
  total,
  offset: 0,
  limit: 3,
});

test('overlapping pages de-duplicate holders without rewinding the offset', () => {
  let list = appendHolders(emptyHolders, page(['a', 'b', 'c'], 7), 3);
  list = appendHolders(list, page(['c', 'd', 'e'], 7), 3);
  assert.deepEqual(list.holders.map((h) => h.pubkey), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(list.consumed, 6);
  assert.equal(list.done, false);
  list = appendHolders(list, page(['e'], 7), 3);
  assert.equal(list.consumed, 7);
  assert.equal(list.holders.length, 5);
  assert.equal(list.done, true);
});

test('a short, empty or missing page ends paging even below the total', () => {
  assert.equal(appendHolders(emptyHolders, page(['a', 'b'], 10), 3).done, true);
  const full = appendHolders(emptyHolders, page(['a', 'b', 'c'], 10), 3);
  assert.equal(appendHolders(full, page([], 10), 3).done, true);
  assert.equal(appendHolders(full, null, 3).done, true);
});

test('reaching the reported total ends paging', () => {
  assert.equal(appendHolders(emptyHolders, page(['a', 'b', 'c'], 3), 3).done, true);
});
