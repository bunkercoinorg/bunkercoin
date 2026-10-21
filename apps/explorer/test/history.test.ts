import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHistoryPage, MAX_HISTORY_ANCHORS, olderAnchor, pushAnchor } from '../lib/history.ts';
import { createGate } from '../lib/request-gate.ts';
import type { Block } from '../lib/types.ts';

const blk = (slot: number): Block => ({ type: 'block', slot, hash: `h${slot}`, status: 'finalized' });
const range = (hi: number, lo: number) => Array.from({ length: hi - lo + 1 }, (_, i) => blk(hi - i));
const nodeWith = (rows: Block[]) => async (offset: number, limit: number) => rows.slice(offset, offset + limit);

test('a history page is filled to its size across a straddling probe', async () => {
  const page = await fetchHistoryPage({ cursor: 181, estimate: 20 }, 50, nodeWith(range(200, 1)));
  assert.deepEqual(page.blocks.map((b) => b.slot), range(180, 131).map((b) => b.slot));
  assert.equal(page.exhausted, false);
  const next = olderAnchor({ anchors: [], ...page })!;
  assert.equal(next.cursor, 131);
  const second = await fetchHistoryPage(next, 50, nodeWith(range(200, 1)));
  assert.equal(second.blocks[0].slot, 130);
});

test('history reports its end only when nothing was cut off', async () => {
  const tail = await fetchHistoryPage({ cursor: 31, estimate: 170 }, 50, nodeWith(range(200, 1)));
  assert.deepEqual(tail.blocks.map((b) => b.slot), range(30, 1).map((b) => b.slot));
  assert.equal(tail.exhausted, true);
  assert.equal(olderAnchor({ anchors: [], ...tail }), null);
  const exact = await fetchHistoryPage({ cursor: 51, estimate: 150 }, 50, nodeWith(range(200, 1)));
  assert.equal(exact.blocks.length, 50);
  assert.equal(exact.exhausted, true);
});

test('the way back is bounded', () => {
  let anchors = [{ cursor: 0, estimate: 0 }];
  for (let i = 1; i <= MAX_HISTORY_ANCHORS + 10; i++) anchors = pushAnchor(anchors, { cursor: i, estimate: i });
  assert.equal(anchors.length, MAX_HISTORY_ANCHORS);
  assert.equal(anchors[anchors.length - 1].cursor, MAX_HISTORY_ANCHORS + 10);
});

test('a gate aborts superseded tickets and only lets the current one write', () => {
  const gate = createGate();
  const a = gate.begin();
  assert.equal(gate.busy(), true);
  const b = gate.begin();
  assert.equal(a.signal.aborted, true);
  assert.equal(a.current(), false);
  gate.finish(a);
  assert.equal(gate.busy(), true);
  gate.finish(b);
  assert.equal(gate.busy(), false);
  const c = gate.begin();
  gate.cancel();
  assert.equal(c.signal.aborted, true);
  assert.equal(c.current(), false);
  assert.equal(gate.busy(), false);
});
