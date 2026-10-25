import test from 'node:test';
import assert from 'node:assert/strict';
import { cadenceLabel, cadenceSeries, checkedAgo, coarseAge, estimateCadence, formatSpan, intervals, staleAfter } from '../lib/cadence.ts';
import type { Block } from '../lib/types.ts';

const T = Date.UTC(2026, 9, 22, 12, 0, 0);
const fin = (slot: number, at: number, extra: Partial<Block> = {}): Block => ({
  type: 'block',
  slot,
  hash: `h${slot}`,
  status: 'finalized',
  producer: slot % 2,
  finalized_timestamp: at,
  ...extra,
});

test('cadence is the median gap between consecutive finalized blocks, robust to an outage', () => {
  const blocks = [fin(10, T), fin(9, T - 50_000), fin(8, T - 100_000), fin(7, T - 160_000), fin(6, T - 10 * 3600_000)];
  assert.deepEqual(intervals(blocks, 24), [10 * 3600_000 - 160_000, 60_000, 50_000, 50_000]);
  assert.equal(estimateCadence(blocks), 55_000);
});

test('cadence ignores unfinalized rows, skips and duplicate slots, and needs two finalized blocks', () => {
  const blocks = [
    fin(5, T + 999, { status: 'notarized' }),
    { type: 'skip', slot: 4, hash: 'skip-4', status: 'finalized' } as Block,
    fin(3, T),
    fin(3, T),
    fin(2, T - 40_000),
  ];
  assert.equal(estimateCadence(blocks), 40_000);
  assert.equal(estimateCadence([fin(1, T)]), null);
  assert.equal(estimateCadence([]), null);
});

test('cadence sample keeps only the newest blocks', () => {
  const blocks = [fin(4, T), fin(3, T - 10_000), fin(2, T - 20_000), fin(1, T - 900_000)];
  assert.equal(estimateCadence(blocks, 2), 10_000);
});

test('stale threshold is three expected intervals, clamped', () => {
  assert.equal(staleAfter(276_000), 828_000);
  assert.equal(staleAfter(5_000), 180_000);
  assert.equal(staleAfter(4 * 3600_000), 3600_000);
  assert.equal(staleAfter(null), 180_000);
});

test('spans and ages are coarse', () => {
  assert.equal(formatSpan(52_400), '52 s');
  assert.equal(formatSpan(276_000), '4.6 min');
  assert.equal(formatSpan(300_000), '5 min');
  assert.equal(formatSpan(3 * 3600_000), '3 h');
  assert.equal(cadenceLabel(52_000), '~1 block / 52 s');
  assert.equal(coarseAge(T - 30_000, T), '<1 min');
  assert.equal(coarseAge(T - 4 * 60_000 - 59_000, T), '4 min');
  assert.equal(coarseAge(T - 130 * 60_000, T), '2 h 10 min');
  assert.equal(coarseAge(T - 120 * 60_000, T), '2 h');
  assert.equal(coarseAge(T - 5 * 3600_000, T), '5 h');
  assert.equal(coarseAge(T - 72 * 3600_000, T), '3 d');
  assert.equal(coarseAge(T + 5000, T), '<1 min');
});

test('detail pages say when they last checked, coarsely', () => {
  assert.equal(checkedAgo(T - 12_000, T), 'checked <1 min ago');
  assert.equal(checkedAgo(T - 7 * 60_000, T), 'checked 7 min ago');
  assert.equal(checkedAgo(null, T), '');
  assert.equal(checkedAgo(T, null), '');
});

test('the cadence series clips outages at three medians', () => {
  const blocks = [fin(5, T), fin(4, T - 60_000), fin(3, T - 120_000), fin(2, T - 180_000), fin(1, T - 3600_000)];
  const s = cadenceSeries(blocks, 24)!;
  assert.equal(s.median, 60_000);
  assert.equal(s.cap, 180_000);
  assert.equal(s.clipped, 1);
  assert.deepEqual(s.points, [1, 1 / 3, 1 / 3, 1 / 3]);
  assert.equal(cadenceSeries([fin(2, T), fin(1, T - 1000)], 24), null);
});
