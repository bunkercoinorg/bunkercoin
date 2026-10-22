import test from 'node:test';
import assert from 'node:assert/strict';
import { cellLabel, timelineCells, timelineSummary, timelineView } from '../lib/timeline.ts';
import type { Block } from '../lib/types.ts';

const END = Date.UTC(2026, 9, 22, 12, 0, 0);
const MIN = 60_000;
const STEP = 15 * MIN;
const fin = (slot: number, at: number, producer = 1): Block => ({ type: 'block', slot, hash: `h${slot}`, status: 'finalized', producer, finalized_timestamp: at });
const skip = (slot: number): Block => ({ type: 'skip', slot, hash: `skip-${slot}`, status: 'finalized' });

test('one cell per step ending at `end`, blocks in their bucket newest first', () => {
  const cells = timelineCells([fin(5, END - MIN), fin(4, END - 5 * MIN), fin(3, END - 20 * MIN), fin(1, END - 99 * STEP)], [], END, 4, STEP);
  assert.equal(cells.length, 4);
  assert.equal(cells[0].start, END - 4 * STEP);
  assert.deepEqual(cells.map((c) => c.entries.map((e) => e.slot)), [[], [], [3], [5, 4]]);
  assert.deepEqual(cells.map((c) => c.known), [false, false, true, true]);
});

test('an untimed skip sits with its next newer timed slot; a block at `end` is outside', () => {
  const cells = timelineCells([fin(9, END), fin(8, END - MIN), skip(7), fin(6, END - 20 * MIN)], [], END, 2, STEP);
  assert.deepEqual(cells[1].entries.map((e) => [e.slot, e.skip]), [[8, false], [7, true]]);
  assert.equal(cells[1].entries[1].at, END - MIN);
});

test('an empty bucket inside a covered span is known, outside it is no data', () => {
  const cells = timelineCells([], [{ from: END - STEP - MIN, to: END - STEP + MIN }], END, 3, STEP);
  assert.deepEqual(cells.map((c) => c.known), [false, true, true]);
});

test('labels name the range, counts and each block', () => {
  const [cell] = timelineCells([fin(89_581, END - MIN, 1), skip(89_580), fin(89_579, END - 9 * MIN, 0)], [], END, 1, STEP);
  assert.equal(cellLabel(cell), '11:45–12:00 UTC · 2 blocks, 1 skipped · 89,581 node 1 11:59, 89,580 skipped 11:59, 89,579 node 0 11:51');
  const [empty, none] = timelineCells([], [{ from: END - 2 * STEP, to: END - STEP }], END, 2, STEP);
  assert.equal(cellLabel(empty), '11:30–11:45 UTC · no blocks');
  assert.equal(cellLabel(none), '11:45–12:00 UTC · no data');
  const busy = timelineCells([1, 2, 3, 4, 5].map((s) => fin(s, END - s * MIN)), [], END, 1, STEP)[0];
  assert.match(cellLabel(busy), /5 blocks · .*, \+1 more$/);
});

test('the view stacks oldest at the bottom, caps the stack, and the summary counts gaps', () => {
  const cells = timelineCells([fin(3, END - MIN), skip(2), fin(1, END - 3 * MIN)], [], END, 2, STEP);
  const [gap, col] = timelineView(cells, 2);
  assert.deepEqual(gap, { stack: [], more: false, known: false, label: '11:30–11:45 UTC · no data' });
  assert.deepEqual(col.stack, ['s', 'f']);
  assert.equal(col.more, true);
  assert.equal(timelineSummary(cells, 'last 30 minutes'), 'last 30 minutes: 2 blocks finalized, 1 skipped, no data for 15 min');
  assert.equal(timelineSummary(timelineCells([], [{ from: 0, to: END }], END, 2, STEP), 'w'), 'w: 0 blocks finalized, 0 skipped');
});
