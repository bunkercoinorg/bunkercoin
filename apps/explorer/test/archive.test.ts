import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backfillCursor,
  bound,
  coveredSpans,
  decodeArchive,
  emptyArchive,
  encodeArchive,
  mergeArchive,
  topRun,
} from '../lib/archive.ts';
import { applyCached, applyHead, emptyChain } from '../lib/chain.ts';
import type { Block } from '../lib/types.ts';

const T = Date.UTC(2026, 9, 22, 12, 0, 0);
const MIN = 60_000;
const HOUR = 3600_000;
const fin = (slot: number, at: number, extra: Partial<Block> = {}): Block => ({
  type: 'block',
  slot,
  hash: `h${slot}`,
  status: 'finalized',
  producer: 0,
  finalized_timestamp: at,
  ...extra,
});
const skip = (slot: number): Block => ({ type: 'skip', slot, hash: `skip-${slot}`, status: 'finalized' });
const slots = (bs: Block[]) => bs.map((b) => b.slot);

test('merge keeps settled slots newest first and never regresses a row', () => {
  const a = mergeArchive(emptyArchive, [fin(3, T), fin(5, T + MIN, { status: 'notarized' }), fin(4, T + MIN)], T + MIN);
  assert.deepEqual(slots(a.blocks), [4, 3]);
  const same = mergeArchive(a, [fin(4, T + MIN)], T + MIN);
  assert.equal(same, a);
  const later = mergeArchive(a, [fin(4, T + MIN, { status: 'notarized', hash: 'other' })], T + MIN);
  assert.equal(later.blocks[0].hash, 'h4');
});

test('bounds drop rows older than the window, then beyond the count', () => {
  const blocks = [fin(4, T), fin(3, T - HOUR), fin(2, T - 25 * HOUR), fin(1, T - 26 * HOUR)];
  assert.deepEqual(slots(bound(blocks, T)), [4, 3, 2]);
  assert.deepEqual(slots(bound(blocks, T, { windowMs: 48 * HOUR, maxBlocks: 3 })), [4, 3, 2]);
  assert.deepEqual(slots(mergeArchive(emptyArchive, blocks, T, { windowMs: 30 * HOUR, maxBlocks: 2 }).blocks), [4, 3]);
  assert.deepEqual(slots(bound([fin(2, T - 25 * HOUR), fin(1, T - 26 * HOUR)], T)), []);
});

test('an untimed skip stays only above the lowest kept timed slot', () => {
  assert.deepEqual(slots(bound([fin(5, T), skip(4), fin(3, T - HOUR), skip(2)], T)), [5, 4, 3]);
  assert.deepEqual(slots(bound([skip(9)], T)), []);
});

test('the top run stops at the first missing slot', () => {
  assert.deepEqual(slots(topRun([fin(9, T), skip(8), fin(7, T), fin(5, T)])), [9, 8, 7]);
  assert.deepEqual(topRun([]), []);
});

test('backfill continues below the top run until the window, count or floor is reached', () => {
  const a = { blocks: [fin(10, T), fin(9, T - 5 * MIN), fin(4, T - 2 * HOUR)], floor: null };
  assert.equal(backfillCursor(a, T), 9);
  assert.equal(backfillCursor({ ...a, floor: 9 }, T), null);
  assert.equal(backfillCursor({ blocks: [fin(10, T - 25 * HOUR)], floor: null }, T), null);
  assert.equal(backfillCursor(a, T, { windowMs: 24 * HOUR, maxBlocks: 3 }), null);
  assert.equal(backfillCursor({ blocks: [fin(0, T)], floor: null }, T), null);
  assert.equal(backfillCursor(emptyArchive, T), null);
});

test('covered spans follow unbroken slot runs, the top one reaching the head', () => {
  const blocks = [fin(10, T - 2 * MIN), fin(9, T - 7 * MIN), fin(5, T - HOUR), skip(4), fin(3, T - 2 * HOUR), fin(1, T - 3 * HOUR)];
  assert.deepEqual(coveredSpans(blocks, T), [
    { from: T - 7 * MIN, to: T },
    { from: T - 2 * HOUR, to: T - HOUR },
  ]);
  assert.deepEqual(coveredSpans(blocks, null)[0], { from: T - 7 * MIN, to: T - 2 * MIN });
});

test('the stored record round-trips and anything unreadable starts empty', () => {
  const archive = { blocks: [fin(3, T), skip(2), fin(1, T - MIN)], floor: 0 };
  const radio = [{ at: T, sum: 300, n: 3, peak: 120 }];
  const back = decodeArchive(encodeArchive({ archive, radio }, T), T);
  assert.deepEqual(JSON.parse(JSON.stringify(back)), { archive, radio });
  const old = decodeArchive(encodeArchive({ archive: { blocks: [fin(2, T - 30 * HOUR)], floor: null }, radio: [] }, T), T);
  assert.deepEqual(old.archive.blocks, []);
  const quiet = decodeArchive(encodeArchive({ archive: { blocks: [fin(3, T - HOUR), fin(2, T - 30 * HOUR), fin(1, T - 31 * HOUR)], floor: null }, radio: [] }, T), T);
  assert.deepEqual(slots(quiet.archive.blocks), [3, 2]);
  assert.equal(backfillCursor(quiet.archive, T), null);
  assert.deepEqual(coveredSpans(quiet.archive.blocks, T), [{ from: T - 30 * HOUR, to: T }]);
  for (const bad of [null, '', '{', '{"v":0,"blocks":[]}', '{"v":1,"blocks":[{"slot":"x"}]}']) {
    assert.deepEqual(decodeArchive(bad, T), { archive: emptyArchive, radio: [] });
  }
  const partial = decodeArchive(JSON.stringify({ v: 1, blocks: [], radio: [{ at: 1, sum: 1, n: 0, peak: 1 }, 'x'], floor: 1.5 }), T);
  assert.deepEqual(partial, { archive: emptyArchive, radio: [] });
});

test('a cached run seeds an empty chain view and a later full head page replaces it across a gap', () => {
  const run = [fin(10, T), fin(9, T - MIN)];
  const seeded = applyCached(emptyChain, run).view;
  assert.deepEqual(slots(seeded.blocks), [10, 9]);
  assert.equal(seeded.restTop, 10);
  assert.equal(applyCached(seeded, [fin(99, T)]).view, seeded);
  const page = [fin(30, T), fin(29, T), fin(28, T)];
  assert.deepEqual(slots(applyHead(seeded, page, 3).view.blocks), [30, 29, 28]);
  const near = [fin(12, T), fin(11, T), fin(10, T)];
  assert.deepEqual(slots(applyHead(seeded, near, 3).view.blocks), [12, 11, 10, 9]);
});
