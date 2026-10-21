import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHead,
  applyLive,
  applyOlder,
  applyStatusChange,
  cursorSlot,
  emptyChain,
  fetchOlderThan,
  highestFinalized,
  liveScroll,
  MAX_RENDERED_ROWS,
  MAX_RETAINED_BLOCKS,
  type ChainView,
} from '../lib/chain.ts';
import type { Block, SlotStatus } from '../lib/types.ts';

const blk = (slot: number, status: SlotStatus = 'finalized', extra: Partial<Block> = {}): Block => ({
  type: 'block',
  slot,
  hash: `h${slot}`,
  producer: slot % 4,
  status,
  ...extra,
});
const skip = (slot: number): Block => ({ type: 'skip', slot, hash: `skip-${slot}`, status: 'finalized' });
const range = (hi: number, lo: number, f = (s: number) => blk(s)) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => f(hi - i));
const slots = (v: ChainView) => v.blocks.map((b) => b.slot);

test('head pages merge newest-first and dedupe by slot', () => {
  let { view } = applyHead(emptyChain, range(10, 6), 5);
  ({ view } = applyHead(view, range(12, 8), 5));
  assert.deepEqual(slots(view), [12, 11, 10, 9, 8, 7, 6]);
  assert.equal(view.restTop, 12);
});

test('a late response never regresses a slot status', () => {
  let { view } = applyLive(emptyChain, blk(5, 'finalized'));
  ({ view } = applyHead(view, [blk(5, 'proposed')], 20));
  assert.equal(view.blocks[0].status, 'finalized');
});

test('live updates upsert slots the list has not seen', () => {
  const { view } = applyLive(applyHead(emptyChain, range(3, 1), 20).view, blk(4, 'proposed'));
  assert.deepEqual(slots(view), [4, 3, 2, 1]);
});

test('a skip may replace a dead block at the same status rank', () => {
  let { view } = applyLive(emptyChain, blk(7, 'finalized'));
  ({ view } = applyLive(view, skip(7)));
  assert.equal(view.blocks[0].type, 'skip');
});

test('finalized transitions fire once, only for rows seen pending', () => {
  let r = applyLive(emptyChain, blk(9, 'proposed'));
  r = applyLive(r.view, blk(9, 'notarized'));
  assert.deepEqual(r.finalized, []);
  r = applyLive(r.view, blk(9, 'finalized'));
  assert.deepEqual(r.finalized, [{ slot: 9, producer: 1 }]);
  r = applyLive(r.view, blk(9, 'finalized', { finalized_timestamp: 1 }));
  assert.deepEqual(r.finalized, []);
  assert.deepEqual(applyLive(emptyChain, blk(10)).finalized, []);
  assert.deepEqual(applyLive(applyLive(emptyChain, blk(11, 'proposed')).view, skip(11)).finalized, []);
});

test('status changes apply to the matching slot and hash only', () => {
  const base = applyLive(emptyChain, blk(3, 'proposed')).view;
  const r = applyStatusChange(base, { slot: 3, hash: 'h3', status: 'finalized' });
  assert.equal(r.view.blocks[0].status, 'finalized');
  assert.deepEqual(r.finalized, [{ slot: 3, producer: 3 }]);
  assert.equal(applyStatusChange(base, { slot: 3, hash: 'other', status: 'finalized' }).view, base);
  assert.equal(applyStatusChange(base, { slot: 4, hash: 'h4', status: 'finalized' }).view, base);
});

test('retained rows are capped, evicting the oldest', () => {
  const { view } = applyHead(emptyChain, range(MAX_RETAINED_BLOCKS + 50, 1), MAX_RETAINED_BLOCKS + 100);
  assert.equal(view.blocks.length, MAX_RETAINED_BLOCKS);
  assert.equal(view.blocks[0].slot, MAX_RETAINED_BLOCKS + 50);
  assert.equal(cursorSlot(view), 51);
});

test('eviction re-opens exhausted history', () => {
  const older = applyOlder({ ...emptyChain, blocks: range(10, 6) }, range(5, 1), true, 100).view;
  assert.equal(older.exhausted, true);
  assert.equal(applyHead(older, range(12, 11), 20, 10).view.exhausted, false);
  assert.equal(applyHead(older, range(12, 11), 20, 100).view.exhausted, true);
});

test('head polling leaves pagination exhaustion alone', () => {
  const v = applyOlder(applyHead(emptyChain, range(5, 3), 20).view, range(2, 1), true).view;
  assert.equal(applyHead(v, range(6, 4), 3).view.exhausted, true);
});

test('a full head page above the REST frontier resets to the head', () => {
  let { view } = applyHead(emptyChain, range(10, 6), 5);
  ({ view } = applyLive(view, blk(40, 'proposed')));
  ({ view } = applyHead(view, range(40, 36), 5));
  assert.deepEqual(slots(view), [40, 39, 38, 37, 36]);
  assert.equal(view.exhausted, false);
  assert.equal(view.restTop, 40);
});

test('a full head page adjacent to the REST frontier is contiguous', () => {
  let { view } = applyHead(emptyChain, range(10, 6), 5);
  ({ view } = applyLive(view, blk(15, 'proposed')));
  ({ view } = applyHead(view, range(15, 11), 5));
  assert.deepEqual(slots(view), range(15, 6).map((b) => b.slot));
  assert.equal(view.restTop, 15);
});

test('a short head page is the whole chain, never a gap', () => {
  let { view } = applyHead(emptyChain, range(3, 1), 20);
  ({ view } = applyHead(view, range(30, 28), 20));
  assert.deepEqual(slots(view), [30, 29, 28, 3, 2, 1]);
});

test('highestFinalized ignores skips and pending rows', () => {
  const rows = [blk(9, 'proposed'), skip(8), blk(7), blk(6)];
  assert.equal(highestFinalized(rows)?.slot, 7);
  assert.equal(highestFinalized([skip(1)]), null);
});

test('retention stays fixed however far the list has scrolled', () => {
  let { view } = applyHead(emptyChain, range(2000, 1981), 20);
  for (let page = 0; page < 60; page++) {
    const cursor = cursorSlot(view)!;
    view = applyOlder(view, range(cursor - 1, cursor - 20), false).view;
    assert.ok(view.blocks.length <= MAX_RETAINED_BLOCKS);
  }
  assert.equal(view.blocks.length, MAX_RETAINED_BLOCKS);
  ({ view } = applyLive(view, blk(2001, 'proposed')));
  assert.equal(view.blocks.length, MAX_RETAINED_BLOCKS);
  assert.equal(view.blocks[0].slot, 2001);
});

test('live scrolling grows the window, then the cache, then hands off to history', () => {
  assert.equal(liveScroll(20, 40, 40, false, 20), 'grow');
  assert.equal(liveScroll(20, 20, 20, false, 20), 'fetch');
  assert.equal(liveScroll(MAX_RENDERED_ROWS, 300, 300, false, 20), 'browse');
  assert.equal(liveScroll(MAX_RENDERED_ROWS, 300, 300, true, 20), 'browse');
  assert.equal(liveScroll(60, 60, MAX_RETAINED_BLOCKS, false, 20), 'browse');
  assert.equal(liveScroll(30, 30, 30, true, 20), 'end');
});

// Simulated node: rows newest-first, paged only by offset.
function nodeWith(rows: Block[], calls: number[] = []) {
  return async (offset: number, limit: number) => {
    calls.push(offset);
    return rows.slice(offset, offset + limit);
  };
}

test('fetchOlderThan returns rows strictly below the cursor', async () => {
  const chain = range(100, 1);
  const r = await fetchOlderThan(81, 20, 20, nodeWith(chain));
  assert.deepEqual(r.blocks.map((b) => b.slot), range(80, 66).map((b) => b.slot));
  assert.equal(r.exhausted, false);
});

test('fetchOlderThan walks forward when the head grew', async () => {
  const chain = range(200, 1);
  const calls: number[] = [];
  const r = await fetchOlderThan(81, 20, 20, nodeWith(chain, calls));
  assert.equal(r.blocks[0].slot, 80);
  assert.ok(calls.length > 1);
});

test('fetchOlderThan steps back when the estimate overshot', async () => {
  const chain = range(100, 1);
  const r = await fetchOlderThan(95, 80, 20, nodeWith(chain));
  assert.equal(r.blocks[0].slot, 94);
});

test('fetchOlderThan handles slot gaps and the end of history', async () => {
  const chain = [...range(100, 90), ...range(50, 45)];
  const r = await fetchOlderThan(90, 11, 20, nodeWith(chain));
  assert.deepEqual(r.blocks.map((b) => b.slot), [50, 49, 48, 47, 46, 45]);
  assert.equal(r.exhausted, true);
  const end = await fetchOlderThan(45, 17, 20, nodeWith(chain));
  assert.deepEqual(end, { blocks: [], exhausted: true, nextOffset: 17 });
});

test('fetchOlderThan gives up instead of looping forever', async () => {
  let head = 1000;
  const runaway = async (offset: number, limit: number) => {
    head += 1000;
    return range(head - offset, head - offset - limit + 1);
  };
  await assert.rejects(fetchOlderThan(10, 0, 20, runaway), /cursor/);
});
