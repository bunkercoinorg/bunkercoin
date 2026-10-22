import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSample, stripFrame } from '../lib/strip.ts';

const END = Date.UTC(2026, 9, 21, 21, 4, 0);

test('one column per 2s step, gaps where no sample arrived', () => {
  const f = stripFrame([{ at: END - 1000, bps: 4000 }, { at: END - 5000, bps: 2000 }], [], END, 4);
  assert.deepEqual(f.columns.map((c) => c.level), [null, 4, null, 8]);
  assert.equal(f.peak, '4.00 kb/s');
  assert.equal(f.summary, 'last 2 minutes: average 3.00 kb/s, 0 blocks finalized, 2 gaps');
});

test('zero throughput is a measured sample with no lit cells, not a gap', () => {
  const f = stripFrame([{ at: END, bps: 0 }], [], END, 2);
  assert.deepEqual(f.columns, [{ level: null }, { level: 0 }]);
});

test('finalized blocks label their sampled column with the highest slot', () => {
  const f = stripFrame(
    [{ at: END - 500, bps: 1000 }],
    [{ slot: 48210, at: END - 900 }, { slot: 48211, at: END - 100 }, { slot: 1, at: END - 99_999_999 }],
    END,
    2,
  );
  assert.equal(f.columns[1].finalized, '48,211 finalized 21:03:59 UTC');
  assert.match(f.summary, /1 block finalized, 1 gap$/);
});

test('a finalized mark on a gap column is neither counted nor listed; drawn marks are listed', () => {
  const f = stripFrame([{ at: END - 500, bps: 1000 }], [{ slot: 7, at: END - 2500 }, { slot: 8, at: END - 100 }], END, 2);
  assert.equal(f.columns[0].finalized, undefined);
  assert.match(f.summary, /1 block finalized, 1 gap$/);
  assert.deepEqual(f.samples, [{ time: '21:03:59 UTC', value: '1.00 kb/s', finalized: '8 at 21:03:59 UTC' }]);
});

test('samples outside the window are ignored and the table lists newest first', () => {
  const f = stripFrame([{ at: END - 10_000, bps: 9 }, { at: END - 3000, bps: 1000 }, { at: END - 1000, bps: 3000 }], [], END, 2);
  assert.deepEqual(f.samples.map((s) => s.value), ['3.00 kb/s', '1.00 kb/s']);
  assert.equal(stripFrame([], [], END, 2).summary, 'last 2 minutes: no samples');
});

test('appendSample keeps time order and caps the buffer', () => {
  let s = appendSample([], { at: 1, bps: 1 }, 2);
  s = appendSample(s, { at: 2, bps: 2 }, 2);
  s = appendSample(s, { at: 3, bps: 3 }, 2);
  assert.deepEqual(s.map((x) => x.at), [2, 3]);
  assert.deepEqual(appendSample(s, { at: 2, bps: 9 }, 5).map((x) => x.at), [2]);
});

test('radio samples fold into 30s buckets, bounded, late samples dropped', async () => {
  const { addToBuckets, bucketSamples, joinBuckets } = await import('../lib/strip.ts');
  let b = addToBuckets([], { at: END + 1000, bps: 100 });
  b = addToBuckets(b, { at: END + 3000, bps: 300 });
  b = addToBuckets(b, { at: END + 31_000, bps: 50 });
  assert.deepEqual(b, [
    { at: END, sum: 400, n: 2, peak: 300 },
    { at: END + 30_000, sum: 50, n: 1, peak: 50 },
  ]);
  assert.equal(addToBuckets(b, { at: END + 2000, bps: 9 }), b);
  assert.equal(addToBuckets(b, { at: END + 90_000, bps: 1 }, 30_000, 2).length, 2);
  assert.deepEqual(bucketSamples(b), [{ at: END + 30_000, bps: 200 }, { at: END + 60_000, bps: 50 }]);
  assert.deepEqual(joinBuckets([{ at: END - 30_000, sum: 1, n: 1, peak: 1 }, b[0]], [b[0], b[1]]), [{ at: END - 30_000, sum: 1, n: 1, peak: 1 }, ...b]);
});

test('bucket means land one per column in a 30-minute frame', async () => {
  const { bucketSamples, kbps } = await import('../lib/strip.ts');
  const f = stripFrame(bucketSamples([{ at: END - 30_000, sum: 1500, n: 15, peak: 200 }]), [], END, 2, 30_000, 'last minute');
  assert.deepEqual(f.columns.map((c) => c.level), [null, 8]);
  assert.equal(f.summary, 'last minute: average 100 b/s, 0 blocks finalized, 1 gap');
  assert.equal(kbps(77.4), '77 b/s');
  assert.equal(kbps(2500), '2.50 kb/s');
});
